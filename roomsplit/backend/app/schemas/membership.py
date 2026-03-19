import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class MemberOut(BaseModel):
    user_id: uuid.UUID
    user_name: str
    user_phone: str
    user_upi_id: Optional[str] = None
    role_id: uuid.UUID
    role_name: str
    joined_at: datetime
    status: str

    model_config = {"from_attributes": True}


class AssignRoleRequest(BaseModel):
    role_id: uuid.UUID
