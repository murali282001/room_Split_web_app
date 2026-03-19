import uuid
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.models.payment import Payment
from app.schemas.payment import (
    PaymentOut,
    MarkPaidRequest,
    RejectRequest,
    UPILinkResponse,
    PaymentStatusSummary,
)
from app.schemas.common import MessageResponse, PaginatedResponse
from app.services import payment_service, notification_service
from app.services.rbac_service import get_user_permissions
from app.utils.exceptions import NotFoundError, ForbiddenError
from app.utils.currency import paise_to_rupees
from datetime import date

router = APIRouter(prefix="/api/v1", tags=["Payments"])


def _payment_to_out(p: Payment, payer_name: str) -> PaymentOut:
    return PaymentOut(
        id=p.id,
        group_id=p.group_id,
        cycle_id=p.cycle_id,
        payer_id=p.payer_id,
        payer_name=payer_name,
        amount_paise=p.amount,
        amount_rupees=paise_to_rupees(p.amount),
        upi_ref=p.upi_ref,
        payment_type=p.payment_type,
        status=p.status,
        due_date=p.due_date,
        marked_at=p.marked_at,
        confirmed_at=p.confirmed_at,
        rejection_reason=p.rejection_reason,
        created_at=p.created_at,
    )


@router.get("/groups/{group_id}/payments", response_model=PaginatedResponse[PaymentOut])
async def list_group_payments(
    group_id: uuid.UUID,
    status: Optional[str] = Query(default=None),
    member_id: Optional[uuid.UUID] = Query(default=None),
    cycle_id: Optional[uuid.UUID] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List payments for a group with optional filters."""
    from sqlalchemy import func as sa_func
    query = select(Payment).where(Payment.group_id == group_id)

    if status:
        query = query.where(Payment.status == status)
    if member_id:
        query = query.where(Payment.payer_id == member_id)
    if cycle_id:
        query = query.where(Payment.cycle_id == cycle_id)

    count_result = await db.execute(
        select(sa_func.count()).select_from(query.subquery())
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(Payment.created_at.desc()).offset(offset).limit(page_size))
    payments = result.scalars().all()

    output = []
    for p in payments:
        payer_result = await db.execute(select(User).where(User.id == p.payer_id))
        payer = payer_result.scalar_one_or_none()
        output.append(_payment_to_out(p, payer.name if payer else "Unknown"))

    pages = max(1, (total + page_size - 1) // page_size)
    return {"items": output, "total": total, "page": page, "pages": pages}


@router.get("/payments/{payment_id}", response_model=PaymentOut)
async def get_payment(
    payment_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get payment detail."""
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()
    if payment is None:
        raise NotFoundError("Payment not found")

    payer_result = await db.execute(select(User).where(User.id == payment.payer_id))
    payer = payer_result.scalar_one_or_none()
    return _payment_to_out(payment, payer.name if payer else "Unknown")


@router.get("/payments/{payment_id}/upi-link", response_model=UPILinkResponse)
async def get_upi_link(
    payment_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate UPI deep link and QR code for a payment. Only payer can access."""
    return await payment_service.get_upi_details(payment_id, current_user.id, db)


@router.post("/payments/{payment_id}/mark-paid", response_model=PaymentOut)
async def mark_paid(
    payment_id: uuid.UUID,
    body: MarkPaidRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Payer marks a payment as paid with their UPI transaction reference (UTR)."""
    payment = await payment_service.mark_paid(
        payment_id=payment_id,
        upi_ref=body.upi_ref,
        current_user_id=current_user.id,
        db=db,
        actor=current_user,
    )
    payer_result = await db.execute(select(User).where(User.id == payment.payer_id))
    payer = payer_result.scalar_one_or_none()
    return _payment_to_out(payment, payer.name if payer else "Unknown")


@router.post("/payments/{payment_id}/confirm", response_model=PaymentOut)
async def confirm_payment(
    payment_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin confirms a marked payment. Credits the group wallet."""
    payment = await payment_service.confirm_payment(
        payment_id=payment_id,
        actor_id=current_user.id,
        db=db,
        actor=current_user,
    )
    payer_result = await db.execute(select(User).where(User.id == payment.payer_id))
    payer = payer_result.scalar_one_or_none()
    return _payment_to_out(payment, payer.name if payer else "Unknown")


@router.post("/payments/{payment_id}/reject", response_model=PaymentOut)
async def reject_payment(
    payment_id: uuid.UUID,
    body: RejectRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin rejects a marked payment with a reason."""
    payment = await payment_service.reject_payment(
        payment_id=payment_id,
        actor_id=current_user.id,
        reason=body.rejection_reason,
        db=db,
        actor=current_user,
    )
    payer_result = await db.execute(select(User).where(User.id == payment.payer_id))
    payer = payer_result.scalar_one_or_none()
    return _payment_to_out(payment, payer.name if payer else "Unknown")


@router.post("/payments/{payment_id}/remind", response_model=MessageResponse)
async def send_reminder(
    payment_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a payment reminder notification to the payer. Requires payment.remind permission."""
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()
    if payment is None:
        raise NotFoundError("Payment not found")

    perms = await get_user_permissions(current_user.id, payment.group_id, db)
    if not perms.get("payment.remind", False):
        raise ForbiddenError("You do not have permission to send payment reminders")

    await notification_service.create_notification(
        user_id=payment.payer_id,
        group_id=payment.group_id,
        type="payment_reminder",
        title="Payment Reminder",
        body=f"Friendly reminder: You have a pending payment of \u20b9{paise_to_rupees(payment.amount):,.2f}. Please pay at your earliest convenience.",
        data={"payment_id": str(payment.id)},
        db=db,
    )

    return {"message": "Reminder sent successfully"}
