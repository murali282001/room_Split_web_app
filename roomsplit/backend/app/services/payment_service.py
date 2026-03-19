import uuid
import logging
from datetime import datetime, date, timezone, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_

from app.models.payment import Payment
from app.models.group import Group
from app.models.wallet import GroupWallet
from app.models.wallet_transaction import WalletTransaction
from app.models.user import User
from app.schemas.payment import UPILinkResponse
from app.services import audit_service, notification_service
from app.services.upi_service import generate_upi_link, generate_qr_base64
from app.services.rbac_service import get_user_permissions
from app.utils.exceptions import NotFoundError, ForbiddenError
from app.utils.exceptions import PaymentTransitionError
from app.utils.currency import paise_to_rupees

logger = logging.getLogger(__name__)

# Valid state machine transitions for payments
VALID_TRANSITIONS: dict[str, list[str]] = {
    "pending": ["marked_paid", "expired"],
    "marked_paid": ["confirmed", "rejected"],
    "rejected": ["marked_paid"],  # Payer can re-submit after rejection
    "confirmed": [],   # Terminal
    "expired": [],     # Terminal
}


def _validate_transition(current_status: str, target_status: str) -> None:
    """Raise PaymentTransitionError if the transition is not allowed."""
    allowed = VALID_TRANSITIONS.get(current_status, [])
    if target_status not in allowed:
        raise PaymentTransitionError(
            f"Cannot transition payment from '{current_status}' to '{target_status}'. "
            f"Allowed transitions from '{current_status}': {allowed}"
        )


async def _get_payment_or_404(payment_id: uuid.UUID, db: AsyncSession) -> Payment:
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()
    if payment is None:
        raise NotFoundError("Payment not found")
    return payment


async def get_upi_details(
    payment_id: uuid.UUID,
    current_user_id: uuid.UUID,
    db: AsyncSession,
) -> UPILinkResponse:
    """Fetch payment and generate UPI link + QR code. Only payer can access."""
    payment = await _get_payment_or_404(payment_id, db)

    if payment.payer_id != current_user_id:
        raise ForbiddenError("Only the payer can access UPI payment details")

    # Fetch group for UPI VPA and name
    group_result = await db.execute(select(Group).where(Group.id == payment.group_id))
    group = group_result.scalar_one_or_none()
    if group is None:
        raise NotFoundError("Group not found")

    upi_link = generate_upi_link(
        upi_id=group.rent_collection_upi,
        payee_name=group.name,
        amount_paise=payment.amount,
        payment_id=str(payment.id),
    )
    qr_code_base64 = generate_qr_base64(upi_link)

    return UPILinkResponse(
        upi_link=upi_link,
        qr_code_base64=qr_code_base64,
        amount_rupees=paise_to_rupees(payment.amount),
        payee_name=group.name,
        payee_upi=group.rent_collection_upi,
    )


async def mark_paid(
    payment_id: uuid.UUID,
    upi_ref: str,
    current_user_id: uuid.UUID,
    db: AsyncSession,
    actor: Optional[User] = None,
) -> Payment:
    """
    Transition pending -> marked_paid.
    If group.auto_confirm_payments: auto-confirm.
    Else: notify admin.
    """
    payment = await _get_payment_or_404(payment_id, db)

    # Check payer
    if payment.payer_id != current_user_id:
        raise ForbiddenError("Only the payer can mark a payment as paid")

    _validate_transition(payment.status, "marked_paid")

    now = datetime.now(timezone.utc)
    payment.status = "marked_paid"
    payment.upi_ref = upi_ref
    payment.marked_at = now
    await db.flush()

    await audit_service.log(
        db=db,
        action="payment.marked_paid",
        entity_type="payment",
        entity_id=payment.id,
        before_state={"status": "pending"},
        after_state={"status": "marked_paid", "upi_ref": upi_ref},
        actor=actor,
        group_id=payment.group_id,
    )

    # Check auto-confirm
    group_result = await db.execute(select(Group).where(Group.id == payment.group_id))
    group = group_result.scalar_one_or_none()

    if group and group.auto_confirm_payments:
        await confirm_payment(payment.id, current_user_id, db, actor=actor, _skip_permission_check=True)
    else:
        # Notify group admins
        await notification_service.notify_group_members(
            group_id=payment.group_id,
            type="payment_marked",
            title="Payment Marked — Awaiting Confirmation",
            body=f"A payment of ₹{paise_to_rupees(payment.amount):,.2f} has been marked as paid. Please review.",
            data={"payment_id": str(payment.id)},
            db=db,
            exclude_user_id=current_user_id,
        )

    return payment


async def confirm_payment(
    payment_id: uuid.UUID,
    actor_id: uuid.UUID,
    db: AsyncSession,
    actor: Optional[User] = None,
    _skip_permission_check: bool = False,
) -> Payment:
    """
    Transition marked_paid -> confirmed.
    Credit group wallet with SELECT FOR UPDATE for race condition safety.
    """
    payment = await _get_payment_or_404(payment_id, db)
    _validate_transition(payment.status, "confirmed")

    if not _skip_permission_check:
        perms = await get_user_permissions(actor_id, payment.group_id, db)
        if not perms.get("payment.confirm", False):
            raise ForbiddenError("You do not have permission to confirm payments")

    now = datetime.now(timezone.utc)
    payment.status = "confirmed"
    payment.confirmed_at = now
    payment.confirmed_by = actor_id
    await db.flush()

    # Credit wallet — SELECT FOR UPDATE for race condition safety
    wallet_result = await db.execute(
        select(GroupWallet)
        .where(GroupWallet.group_id == payment.group_id)
        .with_for_update()
    )
    wallet = wallet_result.scalar_one_or_none()
    if wallet is None:
        raise NotFoundError("Group wallet not found")

    old_balance = wallet.balance
    new_balance = wallet.balance + payment.amount
    wallet.balance = new_balance
    wallet.version += 1
    wallet.last_updated_at = now

    # Insert wallet transaction (immutable ledger entry)
    tx = WalletTransaction(
        group_id=payment.group_id,
        payment_id=payment.id,
        transaction_type="credit",
        amount=payment.amount,
        balance_after=new_balance,
        description=f"Rent payment confirmed — ref: {payment.upi_ref or 'N/A'}",
        created_by=actor_id,
    )
    db.add(tx)
    await db.flush()

    # Notify payer
    await notification_service.create_notification(
        user_id=payment.payer_id,
        group_id=payment.group_id,
        type="payment_confirmed",
        title="Payment Confirmed",
        body=f"Your payment of \u20b9{paise_to_rupees(payment.amount):,.2f} has been confirmed.",
        data={"payment_id": str(payment.id)},
        db=db,
    )

    await audit_service.log(
        db=db,
        action="payment.confirmed",
        entity_type="payment",
        entity_id=payment.id,
        before_state={"status": "marked_paid", "wallet_balance": old_balance},
        after_state={"status": "confirmed", "wallet_balance": new_balance},
        actor=actor,
        group_id=payment.group_id,
    )

    return payment


async def reject_payment(
    payment_id: uuid.UUID,
    actor_id: uuid.UUID,
    reason: str,
    db: AsyncSession,
    actor: Optional[User] = None,
) -> Payment:
    """Transition marked_paid -> rejected."""
    payment = await _get_payment_or_404(payment_id, db)
    _validate_transition(payment.status, "rejected")

    perms = await get_user_permissions(actor_id, payment.group_id, db)
    if not perms.get("payment.reject", False):
        raise ForbiddenError("You do not have permission to reject payments")

    now = datetime.now(timezone.utc)
    payment.status = "rejected"
    payment.rejected_at = now
    payment.rejected_by = actor_id
    payment.rejection_reason = reason
    await db.flush()

    # Notify payer
    await notification_service.create_notification(
        user_id=payment.payer_id,
        group_id=payment.group_id,
        type="payment_rejected",
        title="Payment Rejected",
        body=f"Your payment was rejected: {reason}",
        data={"payment_id": str(payment.id), "reason": reason},
        db=db,
    )

    await audit_service.log(
        db=db,
        action="payment.rejected",
        entity_type="payment",
        entity_id=payment.id,
        before_state={"status": "marked_paid"},
        after_state={"status": "rejected", "reason": reason},
        actor=actor,
        group_id=payment.group_id,
    )

    return payment


async def expire_overdue_payments(db: AsyncSession) -> int:
    """
    Called by Celery task.
    Find all pending payments where due_date < today - 7 days.
    Set status = 'expired'.
    Returns count of expired payments.
    """
    threshold = date.today() - timedelta(days=7)

    result = await db.execute(
        select(Payment).where(
            Payment.status == "pending",
            Payment.due_date < threshold,
        )
    )
    overdue_payments = result.scalars().all()

    now = datetime.now(timezone.utc)
    count = 0
    for payment in overdue_payments:
        _validate_transition(payment.status, "expired")
        payment.status = "expired"
        await audit_service.log(
            db=db,
            action="payment.expired",
            entity_type="payment",
            entity_id=payment.id,
            before_state={"status": "pending"},
            after_state={"status": "expired"},
            group_id=payment.group_id,
        )
        count += 1

    if count > 0:
        await db.flush()
        logger.info(f"Expired {count} overdue payments")

    return count
