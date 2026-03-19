import uuid
from typing import List

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.models.group import Group
from app.models.membership import Membership
from app.models.role import Role
from app.schemas.group import GroupCreate, GroupUpdate, GroupOut, GroupDetail, MemberSummary
from app.schemas.common import MessageResponse
from app.services import group_service
from app.utils.exceptions import NotFoundError
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/groups", tags=["Groups"], redirect_slashes=False)


class JoinGroupRequest(BaseModel):
    invite_code: str


@router.get("", response_model=List[GroupOut])
async def list_groups(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all groups the current user is an active member of."""
    membership_result = await db.execute(
        select(Membership.group_id).where(
            Membership.user_id == current_user.id,
            Membership.status == "active",
        )
    )
    group_ids = membership_result.scalars().all()

    groups_result = await db.execute(
        select(Group).where(Group.id.in_(group_ids), Group.deleted_at.is_(None))
    )
    groups = groups_result.scalars().all()

    # Get member counts
    counts_result = await db.execute(
        select(Membership.group_id, func.count(Membership.id).label("cnt"))
        .where(Membership.group_id.in_(group_ids), Membership.status == "active")
        .group_by(Membership.group_id)
    )
    counts = {row.group_id: row.cnt for row in counts_result}

    output = []
    for g in groups:
        out = GroupOut.model_validate(g)
        out.member_count = counts.get(g.id, 0)
        output.append(out)

    return output


@router.post("", response_model=GroupOut, status_code=201)
async def create_group(
    body: GroupCreate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new group. Current user becomes admin."""
    group = await group_service.create_group(
        data=body,
        creator_id=current_user.id,
        db=db,
        actor=current_user,
    )
    out = GroupOut.model_validate(group)
    out.member_count = 1
    return out


@router.get("/{group_id}", response_model=GroupDetail)
async def get_group(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get group detail with member list."""
    group = await group_service.get_group_or_404(group_id, db)

    # Verify user is a member
    membership_result = await db.execute(
        select(Membership).where(
            Membership.group_id == group_id,
            Membership.user_id == current_user.id,
            Membership.status == "active",
        )
    )
    if membership_result.scalar_one_or_none() is None:
        raise NotFoundError("Group not found or you are not a member")

    # Fetch members
    members_result = await db.execute(
        select(Membership, User, Role)
        .join(User, Membership.user_id == User.id)
        .join(Role, Membership.role_id == Role.id)
        .where(Membership.group_id == group_id, Membership.status == "active")
    )
    rows = members_result.all()

    members = [
        MemberSummary(
            user_id=user.id,
            user_name=user.name,
            user_phone=user.phone,
            role_name=role.name,
        )
        for membership, user, role in rows
    ]

    out = GroupDetail.model_validate(group)
    out.member_count = len(members)
    out.members = members
    return out


@router.delete("/{group_id}", response_model=MessageResponse)
async def delete_group(
    group_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a group. Only the group creator can perform this action."""
    await group_service.delete_group(
        group_id=group_id,
        actor_id=current_user.id,
        db=db,
        actor=current_user,
    )
    return {"message": "Group deleted successfully"}


@router.put("/{group_id}", response_model=GroupOut)
async def update_group(
    group_id: uuid.UUID,
    body: GroupUpdate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update group settings. Requires group.settings permission."""
    group = await group_service.update_group(
        group_id=group_id,
        data=body,
        actor_id=current_user.id,
        db=db,
        actor=current_user,
    )
    return GroupOut.model_validate(group)


@router.post("/{group_id}/invite", response_model=dict)
async def refresh_invite(
    group_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Refresh the group invite code (expires in 7 days)."""
    new_code = await group_service.refresh_invite_code(
        group_id=group_id,
        actor_id=current_user.id,
        db=db,
        actor=current_user,
    )
    return {"invite_code": new_code}


@router.post("/join", response_model=GroupOut)
async def join_group(
    body: JoinGroupRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Join a group using an invite code. Returns the joined group."""
    membership = await group_service.join_group(
        invite_code=body.invite_code,
        user_id=current_user.id,
        db=db,
        actor=current_user,
    )
    group = await group_service.get_group_or_404(membership.group_id, db)
    count_result = await db.execute(
        select(func.count(Membership.id)).where(
            Membership.group_id == membership.group_id,
            Membership.status == "active",
        )
    )
    out = GroupOut.model_validate(group)
    out.member_count = count_result.scalar() or 0
    return out
