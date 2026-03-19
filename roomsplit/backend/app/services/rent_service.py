import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.rent_cycle import RentCycle
from app.models.rent_assignment import RentAssignment
from app.models.payment import Payment
from app.models.membership import Membership
from app.models.group import Group
from app.models.user import User
from app.schemas.rent import RentCycleCreate, RentCycleUpdate
from app.services.rbac_service import get_user_permissions
from app.services import audit_service, notification_service
from app.utils.exceptions import NotFoundError, ForbiddenError
from app.utils.currency import rupees_to_paise

logger = logging.getLogger(__name__)


def calculate_equal_split(total_paise: int, member_count: int) -> List[int]:
    """
    Returns list of amounts in paise summing exactly to total_paise.
    Uses integer division with remainder distribution to avoid float errors.
    First `remainder` members get base+1, rest get base.
    """
    if member_count <= 0:
        return []
    base = total_paise // member_count
    remainder = total_paise % member_count
    return [base + 1 if i < remainder else base for i in range(member_count)]


async def create_cycle(
    data: RentCycleCreate,
    group_id: uuid.UUID,
    creator_id: uuid.UUID,
    db: AsyncSession,
    actor: Optional[User] = None,
) -> RentCycle:
    """
    Validate dates, create RentCycle with status='draft'.
    """
    # Check group exists
    group_result = await db.execute(
        select(Group).where(Group.id == group_id, Group.deleted_at.is_(None))
    )
    group = group_result.scalar_one_or_none()
    if group is None:
        raise NotFoundError(f"Group {group_id} not found")

    # Check permission
    perms = await get_user_permissions(creator_id, group_id, db)
    if not perms.get("cycle.create", False):
        raise ForbiddenError("You do not have permission to create rent cycles")

    # Validate dates
    if data.period_end <= data.period_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="period_end must be after period_start",
        )
    if not (data.period_start <= data.due_date <= data.period_end):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="due_date must be within the period (between period_start and period_end)",
        )

    total_paise = rupees_to_paise(data.total_amount)

    cycle = RentCycle(
        group_id=group_id,
        label=data.label,
        period_start=data.period_start,
        period_end=data.period_end,
        total_amount=total_paise,
        due_date=data.due_date,
        status="draft",
        created_by=creator_id,
        notes=data.notes,
    )
    db.add(cycle)
    await db.flush()

    await audit_service.log(
        db=db,
        action="cycle.created",
        entity_type="rent_cycle",
        entity_id=cycle.id,
        after_state={
            "label": cycle.label,
            "total_amount": total_paise,
            "status": "draft",
        },
        actor=actor,
        group_id=group_id,
    )

    return cycle


async def activate_cycle(
    cycle_id: uuid.UUID,
    actor_id: uuid.UUID,
    db: AsyncSession,
    actor: Optional[User] = None,
) -> RentCycle:
    """
    1. Validate cycle is draft
    2. Check permission
    3. Get active members
    4. Calculate equal splits
    5. Create RentAssignment per member
    6. Create Payment per member
    7. Set cycle status = 'active'
    8. Notify each member
    """
    result = await db.execute(select(RentCycle).where(RentCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    if cycle is None:
        raise NotFoundError("Rent cycle not found")

    if cycle.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot activate a cycle with status '{cycle.status}'. Must be 'draft'.",
        )

    # Check permission
    perms = await get_user_permissions(actor_id, cycle.group_id, db)
    if not perms.get("cycle.activate", False):
        raise ForbiddenError("You do not have permission to activate rent cycles")

    # Get group for UPI and creator info
    group_result = await db.execute(select(Group).where(Group.id == cycle.group_id))
    group = group_result.scalar_one_or_none()
    if group is None:
        raise NotFoundError("Group not found")

    # Get active members
    members_result = await db.execute(
        select(Membership).where(
            Membership.group_id == cycle.group_id,
            Membership.status == "active",
        )
    )
    memberships = members_result.scalars().all()
    member_count = len(memberships)

    if member_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group has no active members",
        )

    # Calculate equal split
    amounts = calculate_equal_split(cycle.total_amount, member_count)

    # Create assignments and payments
    for i, membership in enumerate(memberships):
        assigned_amount = amounts[i]

        assignment = RentAssignment(
            cycle_id=cycle.id,
            member_id=membership.user_id,
            assigned_amount=assigned_amount,
            split_type="equal",
        )
        db.add(assignment)
        await db.flush()

        payment = Payment(
            group_id=cycle.group_id,
            cycle_id=cycle.id,
            assignment_id=assignment.id,
            payer_id=membership.user_id,
            payee_id=group.created_by,
            amount=assigned_amount,
            payment_type="rent",
            status="pending",
            due_date=cycle.due_date,
        )
        db.add(payment)

    await db.flush()

    # Update cycle status
    cycle.status = "active"
    await db.flush()

    # Notify each member
    for membership in memberships:
        await notification_service.create_notification(
            user_id=membership.user_id,
            group_id=cycle.group_id,
            type="rent_due",
            title=f"Rent Due: {cycle.label}",
            body=f"Rent has been activated for {cycle.label}. Please pay by {cycle.due_date}.",
            data={"cycle_id": str(cycle.id)},
            db=db,
        )

    await audit_service.log(
        db=db,
        action="cycle.activated",
        entity_type="rent_cycle",
        entity_id=cycle.id,
        before_state={"status": "draft"},
        after_state={"status": "active", "member_count": member_count},
        actor=actor,
        group_id=cycle.group_id,
    )

    return cycle


async def close_cycle(
    cycle_id: uuid.UUID,
    actor_id: uuid.UUID,
    db: AsyncSession,
    actor: Optional[User] = None,
) -> RentCycle:
    """
    Check cycle is active, check permission, set status = 'closed'.
    """
    result = await db.execute(select(RentCycle).where(RentCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    if cycle is None:
        raise NotFoundError("Rent cycle not found")

    if cycle.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot close a cycle with status '{cycle.status}'. Must be 'active'.",
        )

    perms = await get_user_permissions(actor_id, cycle.group_id, db)
    if not perms.get("cycle.close", False):
        raise ForbiddenError("You do not have permission to close rent cycles")

    now = datetime.now(timezone.utc)
    cycle.status = "closed"
    cycle.closed_by = actor_id
    cycle.closed_at = now
    await db.flush()

    await audit_service.log(
        db=db,
        action="cycle.closed",
        entity_type="rent_cycle",
        entity_id=cycle.id,
        before_state={"status": "active"},
        after_state={"status": "closed"},
        actor=actor,
        group_id=cycle.group_id,
    )

    return cycle


async def update_cycle(
    cycle_id: uuid.UUID,
    data: RentCycleUpdate,
    actor_id: uuid.UUID,
    db: AsyncSession,
    actor: Optional[User] = None,
) -> RentCycle:
    """Update cycle fields — only allowed when status='draft'."""
    result = await db.execute(select(RentCycle).where(RentCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    if cycle is None:
        raise NotFoundError("Rent cycle not found")

    if cycle.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only update cycles with status 'draft'",
        )

    perms = await get_user_permissions(actor_id, cycle.group_id, db)
    if not perms.get("cycle.edit", False):
        raise ForbiddenError("You do not have permission to edit rent cycles")

    before = {
        "label": cycle.label,
        "total_amount": cycle.total_amount,
        "status": cycle.status,
    }

    update_data = data.model_dump(exclude_unset=True)
    if "total_amount" in update_data:
        update_data["total_amount"] = rupees_to_paise(update_data["total_amount"])

    for field, value in update_data.items():
        setattr(cycle, field, value)

    await db.flush()

    await audit_service.log(
        db=db,
        action="cycle.updated",
        entity_type="rent_cycle",
        entity_id=cycle.id,
        before_state=before,
        after_state=update_data,
        actor=actor,
        group_id=cycle.group_id,
    )

    return cycle
