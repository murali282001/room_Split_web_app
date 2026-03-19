import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator


class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    rent_collection_upi: str
    cycle_type: str = "monthly"
    cycle_day: Optional[int] = None

    @field_validator("cycle_type")
    @classmethod
    def validate_cycle_type(cls, v: str) -> str:
        if v not in ("monthly", "custom"):
            raise ValueError("cycle_type must be 'monthly' or 'custom'")
        return v

    @field_validator("cycle_day")
    @classmethod
    def validate_cycle_day(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1 <= v <= 28):
            raise ValueError("cycle_day must be between 1 and 28")
        return v


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    rent_collection_upi: Optional[str] = None
    cycle_type: Optional[str] = None
    cycle_day: Optional[int] = None
    auto_confirm_payments: Optional[bool] = None

    @field_validator("cycle_type")
    @classmethod
    def validate_cycle_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("monthly", "custom"):
            raise ValueError("cycle_type must be 'monthly' or 'custom'")
        return v

    @field_validator("cycle_day")
    @classmethod
    def validate_cycle_day(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1 <= v <= 28):
            raise ValueError("cycle_day must be between 1 and 28")
        return v


class GroupOut(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    rent_collection_upi: str
    cycle_type: str
    cycle_day: Optional[int] = None
    invite_code: str
    is_active: bool
    auto_confirm_payments: bool
    created_by: uuid.UUID
    created_at: datetime
    member_count: Optional[int] = None

    model_config = {"from_attributes": True}


class MemberSummary(BaseModel):
    user_id: uuid.UUID
    user_name: str
    user_phone: str
    role_name: str

    model_config = {"from_attributes": True}


class GroupDetail(GroupOut):
    members: List[MemberSummary] = []
