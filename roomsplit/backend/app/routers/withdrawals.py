import uuid
from typing import List

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.models.withdrawal import Withdrawal
from app.schemas.withdrawal import WithdrawalCreate, WithdrawalOut
from app.schemas.common import MessageResponse
from app.services import withdrawal_service
from app.utils.exceptions import NotFoundError
from app.utils.currency import rupees_to_paise, paise_to_rupees
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/groups/{group_id}/withdrawals", tags=["Withdrawals"])


class CompleteWithdrawalRequest(BaseModel):
    upi_ref: str


class RejectWithdrawalRequest(BaseModel):
    reason: str


def _withdrawal_to_out(w: Withdrawal, requester_name: str) -> WithdrawalOut:
    return WithdrawalOut(
        id=w.id,
        amount_paise=w.amount,
        amount_rupees=paise_to_rupees(w.amount),
        destination_upi=w.destination_upi,
        reason=w.reason,
        status=w.status,
        requested_by_name=requester_name,
        approved_at=w.approved_at,
        completed_at=w.completed_at,
        upi_ref=w.upi_ref,
        created_at=w.created_at,
    )


@router.get("", response_model=List[WithdrawalOut])
async def list_withdrawals(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all withdrawals for the group."""
    result = await db.execute(
        select(Withdrawal)
        .where(Withdrawal.group_id == group_id)
        .order_by(Withdrawal.created_at.desc())
    )
    withdrawals = result.scalars().all()

    output = []
    for w in withdrawals:
        requester_result = await db.execute(select(User).where(User.id == w.requested_by))
        requester = requester_result.scalar_one_or_none()
        output.append(_withdrawal_to_out(w, requester.name if requester else "Unknown"))
    return output


@router.post("", response_model=WithdrawalOut, status_code=201)
async def request_withdrawal(
    group_id: uuid.UUID,
    body: WithdrawalCreate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Request a withdrawal from the group wallet."""
    amount_paise = rupees_to_paise(body.amount)
    withdrawal = await withdrawal_service.request_withdrawal(
        group_id=group_id,
        actor_id=current_user.id,
        amount_paise=amount_paise,
        reason=body.reason,
        db=db,
        actor=current_user,
    )
    return _withdrawal_to_out(withdrawal, current_user.name)


@router.get("/{withdrawal_id}", response_model=WithdrawalOut)
async def get_withdrawal(
    group_id: uuid.UUID,
    withdrawal_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single withdrawal detail."""
    result = await db.execute(
        select(Withdrawal).where(
            Withdrawal.id == withdrawal_id,
            Withdrawal.group_id == group_id,
        )
    )
    w = result.scalar_one_or_none()
    if w is None:
        raise NotFoundError("Withdrawal not found")

    requester_result = await db.execute(select(User).where(User.id == w.requested_by))
    requester = requester_result.scalar_one_or_none()
    return _withdrawal_to_out(w, requester.name if requester else "Unknown")


@router.post("/{withdrawal_id}/approve", response_model=WithdrawalOut)
async def approve_withdrawal(
    group_id: uuid.UUID,
    withdrawal_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve a pending withdrawal. Requires withdrawal.approve permission."""
    w = await withdrawal_service.approve_withdrawal(
        withdrawal_id=withdrawal_id,
        actor_id=current_user.id,
        db=db,
        actor=current_user,
    )
    return _withdrawal_to_out(w, current_user.name)


@router.post("/{withdrawal_id}/reject", response_model=WithdrawalOut)
async def reject_withdrawal(
    group_id: uuid.UUID,
    withdrawal_id: uuid.UUID,
    body: RejectWithdrawalRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a pending withdrawal. Requires withdrawal.approve permission."""
    w = await withdrawal_service.reject_withdrawal(
        withdrawal_id=withdrawal_id,
        actor_id=current_user.id,
        reason=body.reason,
        db=db,
        actor=current_user,
    )
    requester_result = await db.execute(select(User).where(User.id == w.requested_by))
    requester = requester_result.scalar_one_or_none()
    return _withdrawal_to_out(w, requester.name if requester else "Unknown")


@router.post("/{withdrawal_id}/complete", response_model=WithdrawalOut)
async def complete_withdrawal(
    group_id: uuid.UUID,
    withdrawal_id: uuid.UUID,
    body: CompleteWithdrawalRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark an approved withdrawal as completed with UTR. Debits the wallet."""
    w = await withdrawal_service.complete_withdrawal(
        withdrawal_id=withdrawal_id,
        actor_id=current_user.id,
        upi_ref=body.upi_ref,
        db=db,
        actor=current_user,
    )
    requester_result = await db.execute(select(User).where(User.id == w.requested_by))
    requester = requester_result.scalar_one_or_none()
    return _withdrawal_to_out(w, requester.name if requester else "Unknown")
