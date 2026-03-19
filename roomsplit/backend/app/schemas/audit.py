import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: int
    group_id: Optional[uuid.UUID] = None
    actor_name: Optional[str] = None
    actor_phone: Optional[str] = None
    action: str
    entity_type: str
    entity_id: uuid.UUID
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}
