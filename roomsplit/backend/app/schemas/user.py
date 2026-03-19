import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class UserBase(BaseModel):
    name: str
    upi_id: Optional[str] = None
    avatar_url: Optional[str] = None


class UserCreate(BaseModel):
    phone: str
    name: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    upi_id: Optional[str] = None
    avatar_url: Optional[str] = None


class UserOut(BaseModel):
    id: uuid.UUID
    phone: str
    name: str
    upi_id: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
