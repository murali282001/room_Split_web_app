import uuid
import logging
from typing import Dict, Optional
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.membership import Membership
from app.models.role import Role
from app.models.user import User
from app.utils.exceptions import ForbiddenError
from app.dependencies import get_current_active_user

logger = logging.getLogger(__name__)

# System role permission definitions
SYSTEM_PERMISSIONS: Dict[str, Dict[str, bool]] = {
    "admin": {
        "cycle.create": True,
        "cycle.activate": True,
        "cycle.close": True,
        "cycle.edit": True,
        "payment.confirm": True,
        "payment.reject": True,
        "payment.remind": True,
        "member.invite": True,
        "member.remove": True,
        "member.suspend": True,
        "role.assign": True,
        "role.manage": True,
        "expense.create": True,
        "expense.approve": True,
        "expense.delete": True,
        "withdrawal.request": True,
        "withdrawal.approve": True,
        "audit.view": True,
        "analytics.view": True,
        "group.settings": True,
    },
    "co_admin": {
        "cycle.create": True,
        "cycle.activate": True,
        "cycle.close": True,
        "payment.confirm": True,
        "payment.reject": True,
        "payment.remind": True,
        "member.invite": True,
        "expense.create": True,
        "expense.approve": True,
        "audit.view": True,
        "analytics.view": True,
    },
    "member": {
        "expense.create": True,
        "analytics.view": True,
    },
}


async def get_user_permissions(
    user_id: uuid.UUID,
    group_id: uuid.UUID,
    db: AsyncSession,
) -> Dict[str, bool]:
    """
    Query the user's membership + role in the group.
    If is_system role: return SYSTEM_PERMISSIONS for that role name.
    Otherwise: return role.permissions from DB (custom role).
    """
    result = await db.execute(
        select(Membership, Role)
        .join(Role, Membership.role_id == Role.id)
        .where(
            Membership.user_id == user_id,
            Membership.group_id == group_id,
            Membership.status == "active",
        )
    )
    row = result.first()

    if row is None:
        return {}

    membership, role = row

    if role.is_system:
        return SYSTEM_PERMISSIONS.get(role.name, {})

    return role.permissions or {}


def require_permission(permission: str):
    """
    FastAPI dependency factory.
    Usage: Depends(require_permission("payment.confirm"))
    """

    async def _check_permission(
        group_id: uuid.UUID,
        current_user: User = Depends(get_current_active_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        perms = await get_user_permissions(current_user.id, group_id, db)
        if not perms.get(permission, False):
            raise ForbiddenError(
                f"You do not have the '{permission}' permission in this group."
            )
        return current_user

    return _check_permission


async def seed_system_roles(
    group_id: uuid.UUID,
    db: AsyncSession,
) -> Dict[str, uuid.UUID]:
    """
    Called when a group is created.
    Inserts admin, co_admin, and member system roles for the group.
    Returns dict of role_name -> role_id.
    """
    role_ids: Dict[str, uuid.UUID] = {}

    for role_name, permissions in SYSTEM_PERMISSIONS.items():
        role = Role(
            group_id=group_id,
            name=role_name,
            is_system=True,
            permissions=permissions,
        )
        db.add(role)
        await db.flush()
        role_ids[role_name] = role.id

    return role_ids
