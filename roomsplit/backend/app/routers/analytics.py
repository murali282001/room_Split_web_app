import uuid
from typing import List, Dict, Any
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.models.payment import Payment
from app.models.rent_cycle import RentCycle
from app.models.membership import Membership
from app.models.expense import Expense
from app.services.rbac_service import get_user_permissions
from app.utils.exceptions import ForbiddenError
from app.utils.currency import paise_to_rupees

router = APIRouter(prefix="/api/v1/groups/{group_id}/analytics", tags=["Analytics"])


@router.get("/summary")
async def get_summary(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Summary for the active rent cycle. Requires analytics.view permission."""
    perms = await get_user_permissions(current_user.id, group_id, db)
    if not perms.get("analytics.view", False):
        raise ForbiddenError("You do not have permission to view analytics")

    # Find active cycle
    cycle_result = await db.execute(
        select(RentCycle).where(
            RentCycle.group_id == group_id,
            RentCycle.status == "active",
        ).order_by(RentCycle.created_at.desc()).limit(1)
    )
    cycle = cycle_result.scalar_one_or_none()

    if cycle is None:
        return {
            "has_active_cycle": False,
            "total_collected_paise": 0,
            "total_collected_rupees": 0.0,
            "outstanding_paise": 0,
            "outstanding_rupees": 0.0,
            "overdue_count": 0,
            "collection_rate_percent": 0.0,
        }

    confirmed_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.cycle_id == cycle.id,
            Payment.status == "confirmed",
        )
    )
    total_collected = confirmed_result.scalar_one()

    today = date.today()
    overdue_result = await db.execute(
        select(func.count(Payment.id)).where(
            Payment.cycle_id == cycle.id,
            Payment.status == "pending",
            Payment.due_date < today,
        )
    )
    overdue_count = overdue_result.scalar_one()

    outstanding = max(0, cycle.total_amount - total_collected)
    collection_rate = round((total_collected / cycle.total_amount * 100), 1) if cycle.total_amount > 0 else 0.0

    return {
        "has_active_cycle": True,
        "cycle_id": str(cycle.id),
        "cycle_label": cycle.label,
        "due_date": cycle.due_date.isoformat(),
        "total_collected_paise": total_collected,
        "total_collected_rupees": paise_to_rupees(total_collected),
        "outstanding_paise": outstanding,
        "outstanding_rupees": paise_to_rupees(outstanding),
        "overdue_count": overdue_count,
        "collection_rate_percent": collection_rate,
    }


@router.get("/trend")
async def get_payment_trend(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Monthly payment trend. Requires analytics.view permission."""
    perms = await get_user_permissions(current_user.id, group_id, db)
    if not perms.get("analytics.view", False):
        raise ForbiddenError("You do not have permission to view analytics")

    cycles_result = await db.execute(
        select(RentCycle).where(
            RentCycle.group_id == group_id,
            RentCycle.status.in_(["active", "closed"]),
        ).order_by(RentCycle.period_start)
    )
    cycles = cycles_result.scalars().all()

    trend = []
    for cycle in cycles:
        confirmed_result = await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.cycle_id == cycle.id,
                Payment.status == "confirmed",
            )
        )
        collected = confirmed_result.scalar_one()
        outstanding = max(0, cycle.total_amount - collected)

        trend.append({
            "cycle_id": str(cycle.id),
            "month": cycle.label,
            "period_start": cycle.period_start.isoformat(),
            "collected_paise": collected,
            "collected_rupees": paise_to_rupees(collected),
            "outstanding_rupees": paise_to_rupees(outstanding),
            "target_paise": cycle.total_amount,
            "target_rupees": paise_to_rupees(cycle.total_amount),
        })

    return trend


@router.get("/standings")
async def get_member_standings(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Per-member payment standings. Requires analytics.view permission."""
    perms = await get_user_permissions(current_user.id, group_id, db)
    if not perms.get("analytics.view", False):
        raise ForbiddenError("You do not have permission to view analytics")

    members_result = await db.execute(
        select(Membership, User)
        .join(User, Membership.user_id == User.id)
        .where(
            Membership.group_id == group_id,
            Membership.status == "active",
        )
    )
    rows = members_result.all()

    today = date.today()
    standings = []

    for membership, user in rows:
        paid_result = await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.group_id == group_id,
                Payment.payer_id == user.id,
                Payment.status == "confirmed",
            )
        )
        total_paid = paid_result.scalar_one()

        owed_result = await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.group_id == group_id,
                Payment.payer_id == user.id,
                Payment.status.in_(["pending", "marked_paid", "rejected"]),
            )
        )
        total_owed = owed_result.scalar_one()

        overdue_result = await db.execute(
            select(func.count(Payment.id)).where(
                Payment.group_id == group_id,
                Payment.payer_id == user.id,
                Payment.status == "pending",
                Payment.due_date < today,
            )
        )
        overdue_count = overdue_result.scalar_one()

        # on_time_rate: confirmed payments out of all non-pending (confirmed + rejected)
        total_result = await db.execute(
            select(func.count(Payment.id)).where(
                Payment.group_id == group_id,
                Payment.payer_id == user.id,
                Payment.status.in_(["confirmed", "rejected"]),
            )
        )
        total_resolved = total_result.scalar_one()
        on_time_rate = round(total_paid / (total_paid + total_owed) * 100) if (total_paid + total_owed) > 0 else 100

        status = "good" if overdue_count == 0 and total_owed == 0 else ("overdue" if overdue_count > 0 else "behind")

        standings.append({
            "member_id": str(user.id),
            "member_name": user.name,
            "total_paid_paise": total_paid,
            "total_paid_rupees": paise_to_rupees(total_paid),
            "total_owed_paise": total_owed,
            "total_owed_rupees": paise_to_rupees(total_owed),
            "on_time_rate": on_time_rate,
            "status": status,
        })

    return standings


@router.get("/expense-breakdown")
async def get_expense_breakdown(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Expense totals grouped by category. Requires analytics.view permission."""
    perms = await get_user_permissions(current_user.id, group_id, db)
    if not perms.get("analytics.view", False):
        raise ForbiddenError("You do not have permission to view analytics")

    result = await db.execute(
        select(Expense.category, func.sum(Expense.total_amount).label("total"))
        .where(Expense.group_id == group_id, Expense.status == "active")
        .group_by(Expense.category)
        .order_by(func.sum(Expense.total_amount).desc())
    )
    rows = result.all()

    grand_total = sum(row.total for row in rows) if rows else 0

    return [
        {
            "category": row.category or "other",
            "total_paise": row.total,
            "total_rupees": paise_to_rupees(row.total),
            "percentage": round(row.total / grand_total * 100, 1) if grand_total > 0 else 0.0,
        }
        for row in rows
    ]
