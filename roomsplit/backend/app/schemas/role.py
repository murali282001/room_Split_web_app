import uuid
from datetime import datetime
from typing import Optional, Dict, List
from pydantic import BaseModel

AVAILABLE_PERMISSIONS: List[str] = [
    "cycle.create",
    "cycle.activate",
    "cycle.close",
    "cycle.edit",
    "payment.confirm",
    "payment.reject",
    "payment.remind",
    "member.invite",
    "member.remove",
    "member.suspend",
    "role.assign",
    "role.manage",
    "expense.create",
    "expense.approve",
    "expense.delete",
    "withdrawal.request",
    "withdrawal.approve",
    "audit.view",
    "analytics.view",
    "group.settings",
]


class RoleCreate(BaseModel):
    name: str
    permissions: Dict[str, bool] = {}


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    permissions: Optional[Dict[str, bool]] = None


class RoleOut(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    name: str
    is_system: bool
    permissions: Dict[str, bool]
    created_at: datetime

    model_config = {"from_attributes": True}
