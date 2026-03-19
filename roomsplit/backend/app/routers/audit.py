import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.audit import AuditLogOut
from app.schemas.common import PaginatedResponse
from app.services.rbac_service import get_user_permissions
from app.utils.exceptions import ForbiddenError

router = APIRouter(prefix="/api/v1/groups/{group_id}/audit", tags=["Audit Log"])


@router.get("", response_model=PaginatedResponse[AuditLogOut])
async def list_audit_logs(
    group_id: uuid.UUID,
    action: Optional[str] = Query(default=None, description="Filter by action, e.g. 'payment.confirmed'"),
    entity_type: Optional[str] = Query(default=None),
    actor_name: Optional[str] = Query(default=None, description="Search by actor name"),
    from_date: Optional[datetime] = Query(default=None),
    to_date: Optional[datetime] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get paginated audit log for the group.
    Requires audit.view permission.
    """
    from sqlalchemy import func as sa_func
    perms = await get_user_permissions(current_user.id, group_id, db)
    if not perms.get("audit.view", False):
        raise ForbiddenError("You do not have permission to view audit logs")

    query = (
        select(AuditLog)
        .where(AuditLog.group_id == group_id)
        .order_by(AuditLog.created_at.desc())
    )

    if action:
        query = query.where(AuditLog.action == action)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if actor_name:
        query = query.where(AuditLog.actor_name.ilike(f"%{actor_name}%"))
    if from_date:
        query = query.where(AuditLog.created_at >= from_date)
    if to_date:
        query = query.where(AuditLog.created_at <= to_date)

    count_result = await db.execute(
        select(sa_func.count()).select_from(query.subquery())
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    logs = result.scalars().all()

    items = [
        AuditLogOut(
            id=log.id,
            group_id=log.group_id,
            actor_name=log.actor_name,
            actor_phone=log.actor_phone,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            before_state=log.before_state,
            after_state=log.after_state,
            created_at=log.created_at,
        )
        for log in logs
    ]
    pages = max(1, (total + page_size - 1) // page_size)
    return {"items": items, "total": total, "page": page, "pages": pages}
