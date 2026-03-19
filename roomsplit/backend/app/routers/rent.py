import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.models.rent_cycle import RentCycle
from app.models.rent_assignment import RentAssignment
from app.models.payment import Payment
from app.schemas.rent import (
    RentCycleCreate,
    RentCycleUpdate,
    RentCycleOut,
    RentAssignmentOut,
)
from app.schemas.common import MessageResponse, PaginatedResponse
from app.services import rent_service
from app.utils.exceptions import NotFoundError
from app.utils.currency import paise_to_rupees

router = APIRouter(prefix="/api/v1/groups/{group_id}/cycles", tags=["Rent Cycles"])


@router.get("", response_model=PaginatedResponse[RentCycleOut])
async def list_cycles(
    group_id: uuid.UUID,
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List rent cycles for a group, optionally filtered by status."""
    from sqlalchemy import func as sa_func
    query = (
        select(RentCycle)
        .where(RentCycle.group_id == group_id)
        .order_by(RentCycle.created_at.desc())
    )
    if status:
        query = query.where(RentCycle.status == status)

    count_result = await db.execute(
        select(sa_func.count()).select_from(query.subquery())
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    cycles = result.scalars().all()

    items = [RentCycleOut.from_orm_model(c) for c in cycles]
    pages = max(1, (total + page_size - 1) // page_size)
    return {"items": items, "total": total, "page": page, "pages": pages}


@router.post("", response_model=RentCycleOut, status_code=201)
async def create_cycle(
    group_id: uuid.UUID,
    body: RentCycleCreate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new rent cycle in draft status."""
    cycle = await rent_service.create_cycle(
        data=body,
        group_id=group_id,
        creator_id=current_user.id,
        db=db,
        actor=current_user,
    )
    return RentCycleOut.from_orm_model(cycle)


@router.get("/{cycle_id}", response_model=RentCycleOut)
async def get_cycle(
    group_id: uuid.UUID,
    cycle_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single rent cycle detail."""
    result = await db.execute(
        select(RentCycle).where(
            RentCycle.id == cycle_id, RentCycle.group_id == group_id
        )
    )
    cycle = result.scalar_one_or_none()
    if cycle is None:
        raise NotFoundError("Rent cycle not found")
    return RentCycleOut.from_orm_model(cycle)


@router.put("/{cycle_id}", response_model=RentCycleOut)
async def update_cycle(
    group_id: uuid.UUID,
    cycle_id: uuid.UUID,
    body: RentCycleUpdate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a draft rent cycle."""
    cycle = await rent_service.update_cycle(
        cycle_id=cycle_id,
        data=body,
        actor_id=current_user.id,
        db=db,
        actor=current_user,
    )
    return RentCycleOut.from_orm_model(cycle)


@router.post("/{cycle_id}/activate", response_model=RentCycleOut)
async def activate_cycle(
    group_id: uuid.UUID,
    cycle_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Activate a draft cycle, creating assignments and payments for all members."""
    cycle = await rent_service.activate_cycle(
        cycle_id=cycle_id,
        actor_id=current_user.id,
        db=db,
        actor=current_user,
    )
    return RentCycleOut.from_orm_model(cycle)


@router.post("/{cycle_id}/close", response_model=RentCycleOut)
async def close_cycle(
    group_id: uuid.UUID,
    cycle_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Close an active rent cycle."""
    cycle = await rent_service.close_cycle(
        cycle_id=cycle_id,
        actor_id=current_user.id,
        db=db,
        actor=current_user,
    )
    return RentCycleOut.from_orm_model(cycle)


@router.get("/{cycle_id}/assignments", response_model=List[RentAssignmentOut])
async def list_assignments(
    group_id: uuid.UUID,
    cycle_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all rent assignments for a cycle."""
    result = await db.execute(
        select(RentAssignment)
        .where(RentAssignment.cycle_id == cycle_id)
        .order_by(RentAssignment.created_at)
    )
    assignments = result.scalars().all()

    # Load member names
    output = []
    for a in assignments:
        from app.models.user import User as UserModel
        user_result = await db.execute(select(UserModel).where(UserModel.id == a.member_id))
        user = user_result.scalar_one_or_none()
        member_name = user.name if user else "Unknown"
        output.append(
            RentAssignmentOut(
                id=a.id,
                cycle_id=a.cycle_id,
                member_id=a.member_id,
                member_name=member_name,
                assigned_amount_paise=a.assigned_amount,
                assigned_amount_rupees=paise_to_rupees(a.assigned_amount),
                split_type=a.split_type,
                notes=a.notes,
            )
        )
    return output


@router.get("/{cycle_id}/payments")
async def list_cycle_payments(
    group_id: uuid.UUID,
    cycle_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all payments for a rent cycle."""
    result = await db.execute(
        select(Payment).where(
            Payment.cycle_id == cycle_id,
            Payment.group_id == group_id,
        ).order_by(Payment.created_at)
    )
    payments = result.scalars().all()

    output = []
    for p in payments:
        from app.models.user import User as UserModel
        payer_result = await db.execute(select(UserModel).where(UserModel.id == p.payer_id))
        payer = payer_result.scalar_one_or_none()
        output.append({
            "id": str(p.id),
            "payer_id": str(p.payer_id),
            "payer_name": payer.name if payer else "Unknown",
            "amount_paise": p.amount,
            "amount_rupees": paise_to_rupees(p.amount),
            "status": p.status,
            "upi_ref": p.upi_ref,
            "due_date": p.due_date.isoformat() if p.due_date else None,
            "marked_at": p.marked_at.isoformat() if p.marked_at else None,
            "confirmed_at": p.confirmed_at.isoformat() if p.confirmed_at else None,
        })

    return output
