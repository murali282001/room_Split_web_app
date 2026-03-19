import uuid
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.models.notification import Notification
from app.schemas.notification import NotificationOut, MarkReadRequest
from app.schemas.common import MessageResponse
from app.services import notification_service
from app.utils.exceptions import NotFoundError

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"], redirect_slashes=False)


@router.get("", response_model=List[NotificationOut])
async def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List notifications for current user — unread first, then newest."""
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.is_read.asc(), Notification.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    return result.scalars().all()


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get count of unread notifications for current user."""
    count = await notification_service.get_unread_count(current_user.id, db)
    return {"unread_count": count}


@router.post("/read", response_model=MessageResponse)
async def mark_notifications_read(
    body: MarkReadRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a list of notifications as read."""
    await notification_service.mark_read(current_user.id, body.notification_ids, db)
    return {"message": "Notifications marked as read"}


@router.delete("/{notif_id}", response_model=MessageResponse)
async def dismiss_notification(
    notif_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Dismiss (delete) a notification."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notif_id,
            Notification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if notif is None:
        raise NotFoundError("Notification not found")

    await db.delete(notif)
    await db.flush()
    return {"message": "Notification dismissed"}
