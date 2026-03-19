import secrets
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from app.models.group import Group
from app.models.membership import Membership
from app.models.role import Role
from app.models.wallet import GroupWallet
from app.models.user import User
from app.schemas.group import GroupCreate, GroupUpdate
from app.services.rbac_service import seed_system_roles, get_user_permissions
from app.services import audit_service
from app.utils.exceptions import NotFoundError, ConflictError, ForbiddenError

logger = logging.getLogger(__name__)


async def create_group(
    data: GroupCreate,
    creator_id: uuid.UUID,
    db: AsyncSession,
    actor: Optional[User] = None,
) -> Group:
    """
    1. Create Group record
    2. Seed system roles (admin, co_admin, member)
    3. Create Membership for creator with admin role
    4. Create GroupWallet with balance=0
    5. Generate invite_code
    6. Audit log: 'group.created'
    """
    invite_code = secrets.token_urlsafe(8)[:12]

    group = Group(
        name=data.name,
        description=data.description,
        created_by=creator_id,
        rent_collection_upi=data.rent_collection_upi,
        cycle_type=data.cycle_type,
        cycle_day=data.cycle_day,
        invite_code=invite_code,
    )
    db.add(group)
    await db.flush()

    # Seed system roles
    role_ids = await seed_system_roles(group.id, db)

    # Create admin membership for creator
    admin_role_id = role_ids["admin"]
    membership = Membership(
        group_id=group.id,
        user_id=creator_id,
        role_id=admin_role_id,
        invited_by=None,
        status="active",
    )
    db.add(membership)

    # Create group wallet
    wallet = GroupWallet(
        group_id=group.id,
        balance=0,
        last_updated_at=datetime.now(timezone.utc),
        version=0,
    )
    db.add(wallet)
    await db.flush()

    await audit_service.log(
        db=db,
        action="group.created",
        entity_type="group",
        entity_id=group.id,
        after_state={"name": group.name, "invite_code": group.invite_code},
        actor=actor,
        group_id=group.id,
    )

    return group


async def get_group_or_404(group_id: uuid.UUID, db: AsyncSession) -> Group:
    result = await db.execute(
        select(Group).where(Group.id == group_id, Group.deleted_at.is_(None))
    )
    group = result.scalar_one_or_none()
    if group is None:
        raise NotFoundError(f"Group {group_id} not found")
    return group


async def join_group(
    invite_code: str,
    user_id: uuid.UUID,
    db: AsyncSession,
    actor: Optional[User] = None,
) -> Membership:
    """
    Find group by invite_code, validate expiry, check user not already member,
    add membership with 'member' role.
    """
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(Group).where(Group.invite_code == invite_code, Group.is_active.is_(True))
    )
    group = result.scalar_one_or_none()
    if group is None:
        raise NotFoundError("Invalid or expired invite code")

    if group.invite_expires_at and group.invite_expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite code has expired",
        )

    # Check already a member
    existing = await db.execute(
        select(Membership).where(
            Membership.group_id == group.id,
            Membership.user_id == user_id,
        )
    )
    existing_membership = existing.scalar_one_or_none()
    if existing_membership:
        if existing_membership.status == "active":
            raise ConflictError("You are already a member of this group")
        # Re-activate if previously left
        existing_membership.status = "active"
        existing_membership.left_at = None
        await db.flush()
        return existing_membership

    # Get member role
    role_result = await db.execute(
        select(Role).where(
            Role.group_id == group.id,
            Role.name == "member",
            Role.is_system.is_(True),
        )
    )
    member_role = role_result.scalar_one_or_none()
    if member_role is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Group roles not properly configured",
        )

    membership = Membership(
        group_id=group.id,
        user_id=user_id,
        role_id=member_role.id,
        invited_by=None,
        status="active",
    )
    db.add(membership)
    await db.flush()

    await audit_service.log(
        db=db,
        action="member.joined",
        entity_type="membership",
        entity_id=membership.id,
        after_state={"user_id": str(user_id), "group_id": str(group.id)},
        actor=actor,
        group_id=group.id,
    )

    return membership


async def remove_member(
    group_id: uuid.UUID,
    target_user_id: uuid.UUID,
    actor_id: uuid.UUID,
    db: AsyncSession,
    actor: Optional[User] = None,
) -> None:
    """
    Check actor has member.remove permission.
    Cannot remove the group creator.
    Set membership.status = 'left', left_at = now.
    """
    group = await get_group_or_404(group_id, db)

    perms = await get_user_permissions(actor_id, group_id, db)
    if not perms.get("member.remove", False):
        raise ForbiddenError("You do not have permission to remove members")

    if group.created_by == target_user_id:
        raise ForbiddenError("Cannot remove the group creator")

    result = await db.execute(
        select(Membership).where(
            Membership.group_id == group_id,
            Membership.user_id == target_user_id,
            Membership.status == "active",
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise NotFoundError("Member not found in this group")

    now = datetime.now(timezone.utc)
    membership.status = "left"
    membership.left_at = now
    await db.flush()

    await audit_service.log(
        db=db,
        action="member.removed",
        entity_type="membership",
        entity_id=membership.id,
        before_state={"status": "active"},
        after_state={"status": "left"},
        actor=actor,
        group_id=group_id,
    )


async def assign_role(
    group_id: uuid.UUID,
    target_user_id: uuid.UUID,
    role_id: uuid.UUID,
    actor_id: uuid.UUID,
    db: AsyncSession,
    actor: Optional[User] = None,
) -> None:
    """
    Check actor has role.assign permission.
    Cannot change role of group creator.
    Update membership.role_id.
    """
    group = await get_group_or_404(group_id, db)

    perms = await get_user_permissions(actor_id, group_id, db)
    if not perms.get("role.assign", False):
        raise ForbiddenError("You do not have permission to assign roles")

    if group.created_by == target_user_id:
        raise ForbiddenError("Cannot change the role of the group creator")

    result = await db.execute(
        select(Membership).where(
            Membership.group_id == group_id,
            Membership.user_id == target_user_id,
            Membership.status == "active",
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise NotFoundError("Member not found in this group")

    # Verify role exists in this group
    role_result = await db.execute(
        select(Role).where(Role.id == role_id, Role.group_id == group_id)
    )
    role = role_result.scalar_one_or_none()
    if role is None:
        raise NotFoundError("Role not found in this group")

    old_role_id = membership.role_id
    membership.role_id = role_id
    await db.flush()

    await audit_service.log(
        db=db,
        action="role.assigned",
        entity_type="membership",
        entity_id=membership.id,
        before_state={"role_id": str(old_role_id)},
        after_state={"role_id": str(role_id)},
        actor=actor,
        group_id=group_id,
    )


async def refresh_invite_code(
    group_id: uuid.UUID,
    actor_id: uuid.UUID,
    db: AsyncSession,
    actor: Optional[User] = None,
) -> str:
    """Generate new invite_code, set invite_expires_at = now + 7 days."""
    group = await get_group_or_404(group_id, db)

    perms = await get_user_permissions(actor_id, group_id, db)
    if not perms.get("group.settings", False) and not perms.get("member.invite", False):
        raise ForbiddenError("You do not have permission to refresh the invite code")

    new_code = secrets.token_urlsafe(8)[:12]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    group.invite_code = new_code
    group.invite_expires_at = expires_at
    await db.flush()

    await audit_service.log(
        db=db,
        action="group.invite_refreshed",
        entity_type="group",
        entity_id=group_id,
        after_state={"invite_code": new_code},
        actor=actor,
        group_id=group_id,
    )

    return new_code


async def delete_group(
    group_id: uuid.UUID,
    actor_id: uuid.UUID,
    db: AsyncSession,
    actor: Optional[User] = None,
) -> None:
    """Soft-delete a group. Only the group creator can delete it."""
    group = await get_group_or_404(group_id, db)

    if group.created_by != actor_id:
        raise ForbiddenError("Only the group creator can delete the group")

    now = datetime.now(timezone.utc)
    group.deleted_at = now
    group.is_active = False
    await db.flush()

    await audit_service.log(
        db=db,
        action="group.deleted",
        entity_type="group",
        entity_id=group_id,
        before_state={"name": group.name, "is_active": True},
        after_state={"deleted_at": now.isoformat(), "is_active": False},
        actor=actor,
        group_id=group_id,
    )


async def update_group(
    group_id: uuid.UUID,
    data: GroupUpdate,
    actor_id: uuid.UUID,
    db: AsyncSession,
    actor: Optional[User] = None,
) -> Group:
    """Update group settings. Requires group.settings permission."""
    group = await get_group_or_404(group_id, db)

    perms = await get_user_permissions(actor_id, group_id, db)
    if not perms.get("group.settings", False):
        raise ForbiddenError("You do not have permission to update group settings")

    before = {
        "name": group.name,
        "description": group.description,
        "rent_collection_upi": group.rent_collection_upi,
        "cycle_type": group.cycle_type,
        "cycle_day": group.cycle_day,
        "auto_confirm_payments": group.auto_confirm_payments,
    }

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(group, field, value)

    await db.flush()

    await audit_service.log(
        db=db,
        action="group.updated",
        entity_type="group",
        entity_id=group_id,
        before_state=before,
        after_state=update_data,
        actor=actor,
        group_id=group_id,
    )

    return group
