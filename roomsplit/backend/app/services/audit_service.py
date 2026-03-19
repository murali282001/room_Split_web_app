import uuid
import logging
from typing import Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog
from app.models.user import User

logger = logging.getLogger(__name__)


async def log(
    db: AsyncSession,
    action: str,
    entity_type: str,
    entity_id: Any,
    before_state: Optional[dict] = None,
    after_state: Optional[dict] = None,
    actor: Optional[User] = None,
    group_id: Optional[uuid.UUID] = None,
    request=None,
) -> None:
    """
    Insert an immutable audit log entry.
    Never update or delete — only insert.
    Actor can be None for system actions.
    """
    try:
        ip_address: Optional[str] = None
        user_agent: Optional[str] = None
        request_id: Optional[uuid.UUID] = None

        if request is not None:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")
            req_id_header = request.headers.get("x-request-id")
            if req_id_header:
                try:
                    request_id = uuid.UUID(req_id_header)
                except ValueError:
                    pass

        # Normalize entity_id to UUID
        if isinstance(entity_id, str):
            entity_id = uuid.UUID(entity_id)

        entry = AuditLog(
            group_id=group_id,
            actor_id=actor.id if actor else None,
            actor_phone=actor.phone if actor else None,
            actor_name=actor.name if actor else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            before_state=before_state,
            after_state=after_state,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
        )
        db.add(entry)
        # Do not flush/commit here — caller controls transaction
    except Exception as exc:
        # Audit failures must never break business logic
        logger.error(f"Failed to write audit log for action={action}: {exc}", exc_info=True)
