import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.models.expense import Expense
from app.models.expense_split import ExpenseSplit
from app.models.membership import Membership
from app.schemas.expense import ExpenseCreate, ExpenseOut, ExpenseSplitOut
from app.schemas.common import MessageResponse, PaginatedResponse
from app.services.rbac_service import get_user_permissions
from app.services import audit_service, notification_service
from app.utils.exceptions import NotFoundError, ForbiddenError
from app.utils.currency import rupees_to_paise, paise_to_rupees
from app.services.rent_service import calculate_equal_split
from datetime import datetime, timezone

router = APIRouter(prefix="/api/v1/groups/{group_id}/expenses", tags=["Expenses"])


async def _load_member_names(splits: list, db: AsyncSession) -> dict:
    """Return {str(member_id): name} for all splits."""
    member_ids = list({s.member_id for s in splits})
    if not member_ids:
        return {}
    result = await db.execute(select(User).where(User.id.in_(member_ids)))
    users = result.scalars().all()
    return {str(u.id): u.name for u in users}


def _expense_to_out(expense: Expense, splits: List[ExpenseSplit], member_names: dict = {}) -> ExpenseOut:
    split_outs = [
        ExpenseSplitOut(
            id=s.id,
            member_id=s.member_id,
            member_name=member_names.get(str(s.member_id), "Unknown"),
            owed_amount_paise=s.owed_amount,
            owed_amount_rupees=paise_to_rupees(s.owed_amount),
            paid_amount_paise=s.paid_amount,
            paid_amount_rupees=paise_to_rupees(s.paid_amount),
            is_settled=s.is_settled,
        )
        for s in splits
    ]
    return ExpenseOut(
        id=expense.id,
        title=expense.title,
        category=expense.category,
        total_amount_paise=expense.total_amount,
        total_amount_rupees=paise_to_rupees(expense.total_amount),
        split_type=expense.split_type,
        expense_date=expense.expense_date,
        status=expense.status,
        created_at=expense.created_at,
        splits=split_outs,
    )


@router.get("", response_model=PaginatedResponse[ExpenseOut])
async def list_expenses(
    group_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all expenses for the group."""
    from sqlalchemy import func as sa_func
    base_query = (
        select(Expense)
        .where(Expense.group_id == group_id, Expense.status != "draft")
        .order_by(Expense.expense_date.desc(), Expense.created_at.desc())
    )

    count_result = await db.execute(
        select(sa_func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(base_query.offset(offset).limit(page_size))
    expenses = result.scalars().all()

    output = []
    for exp in expenses:
        splits_result = await db.execute(
            select(ExpenseSplit).where(ExpenseSplit.expense_id == exp.id)
        )
        splits = splits_result.scalars().all()
        member_names = await _load_member_names(splits, db)
        output.append(_expense_to_out(exp, splits, member_names))

    pages = max(1, (total + page_size - 1) // page_size)
    return {"items": output, "total": total, "page": page, "pages": pages}


@router.post("", response_model=ExpenseOut, status_code=201)
async def create_expense(
    group_id: uuid.UUID,
    body: ExpenseCreate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new expense and auto-split among members.
    For 'equal' split: divides evenly with exact paise arithmetic.
    For 'custom' split: uses provided member amounts (must sum to total).
    Requires expense.create permission.
    """
    perms = await get_user_permissions(current_user.id, group_id, db)
    if not perms.get("expense.create", False):
        raise ForbiddenError("You do not have permission to create expenses")

    total_paise = rupees_to_paise(body.total_amount)

    expense = Expense(
        group_id=group_id,
        created_by=current_user.id,
        title=body.title,
        description=body.description,
        category=body.category,
        total_amount=total_paise,
        split_type=body.split_type,
        expense_date=body.expense_date,
        status="active",
    )
    db.add(expense)
    await db.flush()

    splits = []

    if body.split_type == "equal":
        # Get active members
        members_result = await db.execute(
            select(Membership).where(
                Membership.group_id == group_id,
                Membership.status == "active",
            )
        )
        memberships = members_result.scalars().all()
        amounts = calculate_equal_split(total_paise, len(memberships))

        for i, membership in enumerate(memberships):
            split = ExpenseSplit(
                expense_id=expense.id,
                member_id=membership.user_id,
                owed_amount=amounts[i],
                paid_amount=0,
                is_settled=False,
            )
            db.add(split)
            splits.append(split)

    elif body.split_type == "custom":
        if not body.members:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="For custom split, you must provide member amounts",
            )
        custom_total = sum(rupees_to_paise(m.amount) for m in body.members)
        if custom_total != total_paise:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Custom split amounts ({custom_total} paise) must sum to total ({total_paise} paise)",
            )
        for m in body.members:
            split = ExpenseSplit(
                expense_id=expense.id,
                member_id=m.member_id,
                owed_amount=rupees_to_paise(m.amount),
                paid_amount=0,
                is_settled=False,
            )
            db.add(split)
            splits.append(split)

    await db.flush()

    await audit_service.log(
        db=db,
        action="expense.created",
        entity_type="expense",
        entity_id=expense.id,
        after_state={"title": expense.title, "total_paise": total_paise, "split_type": body.split_type},
        actor=current_user,
        group_id=group_id,
    )

    member_names = await _load_member_names(splits, db)
    return _expense_to_out(expense, splits, member_names)


@router.get("/{expense_id}", response_model=ExpenseOut)
async def get_expense(
    group_id: uuid.UUID,
    expense_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get expense detail with splits."""
    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_id,
            Expense.group_id == group_id,
        )
    )
    expense = result.scalar_one_or_none()
    if expense is None:
        raise NotFoundError("Expense not found")

    splits_result = await db.execute(
        select(ExpenseSplit).where(ExpenseSplit.expense_id == expense_id)
    )
    splits = splits_result.scalars().all()
    member_names = await _load_member_names(splits, db)
    return _expense_to_out(expense, splits, member_names)


@router.delete("/{expense_id}", response_model=MessageResponse)
async def delete_expense(
    group_id: uuid.UUID,
    expense_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Soft-delete an expense.
    Only the creator or a user with expense.delete permission can do this.
    """
    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_id,
            Expense.group_id == group_id,
        )
    )
    expense = result.scalar_one_or_none()
    if expense is None:
        raise NotFoundError("Expense not found")

    perms = await get_user_permissions(current_user.id, group_id, db)
    is_creator = expense.created_by == current_user.id
    has_delete_perm = perms.get("expense.delete", False)

    if not is_creator and not has_delete_perm:
        raise ForbiddenError("You do not have permission to delete this expense")

    expense.status = "draft"  # Soft delete via status
    expense.deleted_at = datetime.now(timezone.utc)
    await db.flush()

    await audit_service.log(
        db=db,
        action="expense.deleted",
        entity_type="expense",
        entity_id=expense.id,
        before_state={"status": "active"},
        after_state={"status": "deleted"},
        actor=current_user,
        group_id=group_id,
    )

    return {"message": "Expense deleted successfully"}
