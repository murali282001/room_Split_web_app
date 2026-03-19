import uuid
from typing import List

from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.models.membership import Membership
from app.models.role import Role
from app.schemas.membership import MemberOut, AssignRoleRequest
from app.schemas.role import RoleCreate, RoleUpdate, RoleOut
from app.schemas.common import MessageResponse
from app.services import group_service
from app.services.rbac_service import get_user_permissions
from app.utils.exceptions import NotFoundError, ForbiddenError

router = APIRouter(prefix="/api/v1/groups/{group_id}", tags=["Members & Roles"])


@router.get("/members", response_model=List[MemberOut])
async def list_members(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all active members of the group with their roles."""
    # Verify current user is a member
    membership_check = await db.execute(
        select(Membership).where(
            Membership.group_id == group_id,
            Membership.user_id == current_user.id,
            Membership.status == "active",
        )
    )
    if membership_check.scalar_one_or_none() is None:
        raise NotFoundError("Group not found or you are not a member")

    result = await db.execute(
        select(Membership, User, Role)
        .join(User, Membership.user_id == User.id)
        .join(Role, Membership.role_id == Role.id)
        .where(Membership.group_id == group_id, Membership.status == "active")
        .order_by(Membership.joined_at)
    )
    rows = result.all()

    return [
        MemberOut(
            user_id=user.id,
            user_name=user.name,
            user_phone=user.phone,
            user_upi_id=user.upi_id,
            role_id=role.id,
            role_name=role.name,
            joined_at=membership.joined_at,
            status=membership.status,
        )
        for membership, user, role in rows
    ]


@router.post("/members/{user_id}/role", response_model=MessageResponse)
async def assign_role(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    body: AssignRoleRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Assign a role to a group member. Requires role.assign permission."""
    await group_service.assign_role(
        group_id=group_id,
        target_user_id=user_id,
        role_id=body.role_id,
        actor_id=current_user.id,
        db=db,
        actor=current_user,
    )
    return {"message": "Role assigned successfully"}


@router.delete("/members/{user_id}", response_model=MessageResponse)
async def remove_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from the group. Requires member.remove permission."""
    await group_service.remove_member(
        group_id=group_id,
        target_user_id=user_id,
        actor_id=current_user.id,
        db=db,
        actor=current_user,
    )
    return {"message": "Member removed successfully"}


@router.put("/members/{user_id}/suspend", response_model=MessageResponse)
async def suspend_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Suspend a member. Requires member.suspend permission."""
    perms = await get_user_permissions(current_user.id, group_id, db)
    if not perms.get("member.suspend", False):
        raise ForbiddenError("You do not have permission to suspend members")

    result = await db.execute(
        select(Membership).where(
            Membership.group_id == group_id,
            Membership.user_id == user_id,
            Membership.status == "active",
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise NotFoundError("Member not found")

    membership.status = "suspended"
    await db.flush()

    return {"message": "Member suspended successfully"}


@router.get("/roles", response_model=List[RoleOut])
async def list_roles(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all roles in the group."""
    result = await db.execute(
        select(Role).where(Role.group_id == group_id).order_by(Role.created_at)
    )
    return result.scalars().all()


@router.post("/roles", response_model=RoleOut, status_code=201)
async def create_role(
    group_id: uuid.UUID,
    body: RoleCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a custom role in the group. Requires role.manage permission."""
    perms = await get_user_permissions(current_user.id, group_id, db)
    if not perms.get("role.manage", False):
        raise ForbiddenError("You do not have permission to manage roles")

    role = Role(
        group_id=group_id,
        name=body.name,
        is_system=False,
        permissions=body.permissions,
    )
    db.add(role)
    await db.flush()
    return role


@router.put("/roles/{role_id}", response_model=RoleOut)
async def update_role(
    group_id: uuid.UUID,
    role_id: uuid.UUID,
    body: RoleUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a custom role's permissions. Requires role.manage permission."""
    perms = await get_user_permissions(current_user.id, group_id, db)
    if not perms.get("role.manage", False):
        raise ForbiddenError("You do not have permission to manage roles")

    result = await db.execute(
        select(Role).where(Role.id == role_id, Role.group_id == group_id)
    )
    role = result.scalar_one_or_none()
    if role is None:
        raise NotFoundError("Role not found")

    if role.is_system:
        raise ForbiddenError("Cannot modify system roles")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(role, field, value)
    await db.flush()
    return role


@router.delete("/roles/{role_id}", response_model=MessageResponse)
async def delete_role(
    group_id: uuid.UUID,
    role_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a custom (non-system) role. Requires role.manage permission."""
    perms = await get_user_permissions(current_user.id, group_id, db)
    if not perms.get("role.manage", False):
        raise ForbiddenError("You do not have permission to manage roles")

    result = await db.execute(
        select(Role).where(Role.id == role_id, Role.group_id == group_id)
    )
    role = result.scalar_one_or_none()
    if role is None:
        raise NotFoundError("Role not found")

    if role.is_system:
        raise ForbiddenError("Cannot delete system roles")

    # Check no active members use this role
    members_check = await db.execute(
        select(Membership).where(Membership.role_id == role_id, Membership.status == "active")
    )
    if members_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a role that is assigned to active members",
        )

    await db.delete(role)
    await db.flush()
    return {"message": "Role deleted successfully"}
