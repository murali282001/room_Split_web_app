import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.withdrawal import Withdrawal
from app.models.wallet import GroupWallet
from app.models.wallet_transaction import WalletTransaction
from app.models.user import User
from app.services import audit_service
from app.services.rbac_service import get_user_permissions
from app.utils.exceptions import NotFoundError, ForbiddenError, ConflictError

logger = logging.getLogger(__name__)


async def request_withdrawal(
    group_id: uuid.UUID,
    actor_id: uuid.UUID,
    amount_paise: int,
    db: AsyncSession,
    reason: Optional[str] = None,
    actor: Optional[User] = None,
) -> Withdrawal:
    """
    1. Check permission
    2. Check wallet balance
    3. Check no pending withdrawal
    4. Create Withdrawal with actor's UPI as destination
    """
    perms = await get_user_permissions(actor_id, group_id, db)
    if not perms.get("withdrawal.request", False):
        raise ForbiddenError("You do not have permission to request withdrawals")

    # Check wallet balance
    wallet_result = await db.execute(
        select(GroupWallet).where(GroupWallet.group_id == group_id)
    )
    wallet = wallet_result.scalar_one_or_none()
    if wallet is None:
        raise NotFoundError("Group wallet not found")

    if wallet.balance < amount_paise:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient wallet balance. Available: {wallet.balance} paise, Requested: {amount_paise} paise",
        )

    # Check no existing pending withdrawal
    pending_result = await db.execute(
        select(Withdrawal).where(
            Withdrawal.group_id == group_id,
            Withdrawal.status == "pending",
        )
    )
    existing_pending = pending_result.scalar_one_or_none()
    if existing_pending is not None:
        raise ConflictError("A withdrawal request is already pending for this group")

    # Get actor's UPI ID
    actor_result = await db.execute(select(User).where(User.id == actor_id))
    actor_user = actor_result.scalar_one_or_none()
    if actor_user is None or not actor_user.upi_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must have a UPI ID on your profile to request a withdrawal",
        )

    withdrawal = Withdrawal(
        group_id=group_id,
        requested_by=actor_id,
        amount=amount_paise,
        destination_upi=actor_user.upi_id,
        reason=reason,
        status="pending",
    )
    db.add(withdrawal)
    await db.flush()

    await audit_service.log(
        db=db,
        action="withdrawal.requested",
        entity_type="withdrawal",
        entity_id=withdrawal.id,
        after_state={
            "amount": amount_paise,
            "destination_upi": actor_user.upi_id,
        },
        actor=actor,
        group_id=group_id,
    )

    return withdrawal


async def approve_withdrawal(
    withdrawal_id: uuid.UUID,
    actor_id: uuid.UUID,
    db: AsyncSession,
    actor: Optional[User] = None,
) -> Withdrawal:
    """Approve a pending withdrawal."""
    result = await db.execute(select(Withdrawal).where(Withdrawal.id == withdrawal_id))
    withdrawal = result.scalar_one_or_none()
    if withdrawal is None:
        raise NotFoundError("Withdrawal not found")

    if withdrawal.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve a withdrawal with status '{withdrawal.status}'",
        )

    perms = await get_user_permissions(actor_id, withdrawal.group_id, db)
    if not perms.get("withdrawal.approve", False):
        raise ForbiddenError("You do not have permission to approve withdrawals")

    now = datetime.now(timezone.utc)
    withdrawal.status = "approved"
    withdrawal.approved_by = actor_id
    withdrawal.approved_at = now
    await db.flush()

    await audit_service.log(
        db=db,
        action="withdrawal.approved",
        entity_type="withdrawal",
        entity_id=withdrawal.id,
        before_state={"status": "pending"},
        after_state={"status": "approved"},
        actor=actor,
        group_id=withdrawal.group_id,
    )

    return withdrawal


async def reject_withdrawal(
    withdrawal_id: uuid.UUID,
    actor_id: uuid.UUID,
    reason: str,
    db: AsyncSession,
    actor: Optional[User] = None,
) -> Withdrawal:
    """Reject a pending withdrawal."""
    result = await db.execute(select(Withdrawal).where(Withdrawal.id == withdrawal_id))
    withdrawal = result.scalar_one_or_none()
    if withdrawal is None:
        raise NotFoundError("Withdrawal not found")

    if withdrawal.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject a withdrawal with status '{withdrawal.status}'",
        )

    perms = await get_user_permissions(actor_id, withdrawal.group_id, db)
    if not perms.get("withdrawal.approve", False):
        raise ForbiddenError("You do not have permission to reject withdrawals")

    withdrawal.status = "rejected"
    withdrawal.rejected_reason = reason
    await db.flush()

    await audit_service.log(
        db=db,
        action="withdrawal.rejected",
        entity_type="withdrawal",
        entity_id=withdrawal.id,
        before_state={"status": "pending"},
        after_state={"status": "rejected", "reason": reason},
        actor=actor,
        group_id=withdrawal.group_id,
    )

    return withdrawal


async def complete_withdrawal(
    withdrawal_id: uuid.UUID,
    actor_id: uuid.UUID,
    upi_ref: str,
    db: AsyncSession,
    actor: Optional[User] = None,
) -> Withdrawal:
    """
    Complete an approved withdrawal.
    Debit wallet with SELECT FOR UPDATE for race condition safety.
    """
    result = await db.execute(select(Withdrawal).where(Withdrawal.id == withdrawal_id))
    withdrawal = result.scalar_one_or_none()
    if withdrawal is None:
        raise NotFoundError("Withdrawal not found")

    if withdrawal.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot complete a withdrawal with status '{withdrawal.status}'. Must be 'approved'.",
        )

    perms = await get_user_permissions(actor_id, withdrawal.group_id, db)
    if not perms.get("withdrawal.approve", False):
        raise ForbiddenError("You do not have permission to complete withdrawals")

    now = datetime.now(timezone.utc)
    withdrawal.status = "completed"
    withdrawal.completed_at = now
    withdrawal.upi_ref = upi_ref
    await db.flush()

    # Debit wallet — SELECT FOR UPDATE
    wallet_result = await db.execute(
        select(GroupWallet)
        .where(GroupWallet.group_id == withdrawal.group_id)
        .with_for_update()
    )
    wallet = wallet_result.scalar_one_or_none()
    if wallet is None:
        raise NotFoundError("Group wallet not found")

    old_balance = wallet.balance
    new_balance = wallet.balance - withdrawal.amount
    if new_balance < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient wallet balance for withdrawal",
        )

    wallet.balance = new_balance
    wallet.version += 1
    wallet.last_updated_at = now

    tx = WalletTransaction(
        group_id=withdrawal.group_id,
        withdrawal_id=withdrawal.id,
        transaction_type="debit",
        amount=withdrawal.amount,
        balance_after=new_balance,
        description=f"Withdrawal completed — UPI ref: {upi_ref}",
        created_by=actor_id,
    )
    db.add(tx)
    await db.flush()

    await audit_service.log(
        db=db,
        action="withdrawal.completed",
        entity_type="withdrawal",
        entity_id=withdrawal.id,
        before_state={"status": "approved", "wallet_balance": old_balance},
        after_state={"status": "completed", "wallet_balance": new_balance, "upi_ref": upi_ref},
        actor=actor,
        group_id=withdrawal.group_id,
    )

    return withdrawal
