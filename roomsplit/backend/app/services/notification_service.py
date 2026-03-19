import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_

from app.models.notification import Notification
from app.models.membership import Membership
from app.models.user import User
from app.config import settings

logger = logging.getLogger(__name__)


async def _whatsapp_notify(user_id: uuid.UUID, title: str, body: str, db: AsyncSession) -> None:
    """Look up user phone and send WhatsApp message if NOTIFICATION_WHATSAPP=true."""
    if not settings.NOTIFICATION_WHATSAPP:
        return
    try:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user and user.phone:
            from app.services.whatsapp_service import send_whatsapp
            message = f"*{title}*\n{body}"
            await send_whatsapp(user.phone, message)
    except Exception as e:
        logger.error(f"[WhatsApp notify] Failed for user {user_id}: {e}")


async def create_notification(
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str,
    db: AsyncSession,
    group_id: Optional[uuid.UUID] = None,
    data: Optional[Dict[str, Any]] = None,
) -> Notification:
    """Insert a single Notification record and optionally send via WhatsApp."""
    notif = Notification(
        user_id=user_id,
        group_id=group_id,
        type=type,
        title=title,
        body=body,
        data=data or {},
    )
    db.add(notif)
    await db.flush()
    await _whatsapp_notify(user_id, title, body, db)
    return notif


async def get_unread_count(user_id: uuid.UUID, db: AsyncSession) -> int:
    """Count unread notifications for a user."""
    from sqlalchemy import func, select

    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        )
    )
    return result.scalar_one()


async def mark_read(
    user_id: uuid.UUID,
    notification_ids: List[uuid.UUID],
    db: AsyncSession,
) -> None:
    """Mark a list of notifications as read for a user."""
    now = datetime.now(timezone.utc)
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.id.in_(notification_ids),
            Notification.is_read.is_(False),
        )
        .values(is_read=True, read_at=now)
    )


async def notify_group_members(
    group_id: uuid.UUID,
    type: str,
    title: str,
    body: str,
    db: AsyncSession,
    data: Optional[Dict[str, Any]] = None,
    exclude_user_id: Optional[uuid.UUID] = None,
) -> None:
    """
    Create a notification for every active member of the group.
    Optionally excludes one user (e.g., the actor who triggered the event).
    """
    query = select(Membership.user_id).where(
        Membership.group_id == group_id,
        Membership.status == "active",
    )
    if exclude_user_id is not None:
        query = query.where(Membership.user_id != exclude_user_id)

    result = await db.execute(query)
    user_ids = result.scalars().all()

    for user_id in user_ids:
        notif = Notification(
            user_id=user_id,
            group_id=group_id,
            type=type,
            title=title,
            body=body,
            data=data or {},
        )
        db.add(notif)

    if user_ids:
        await db.flush()
        for uid in user_ids:
            await _whatsapp_notify(uid, title, body, db)
