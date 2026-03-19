import uuid
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, computed_field
from app.utils.currency import paise_to_rupees


class RentCycleCreate(BaseModel):
    label: str
    period_start: date
    period_end: date
    total_amount: float  # rupees — converted to paise in service
    due_date: date
    notes: Optional[str] = None


class RentCycleUpdate(BaseModel):
    label: Optional[str] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    total_amount: Optional[float] = None  # rupees
    due_date: Optional[date] = None
    notes: Optional[str] = None


class RentCycleOut(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    label: str
    period_start: date
    period_end: date
    total_amount_paise: int
    total_amount_rupees: float
    due_date: date
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_model(cls, cycle) -> "RentCycleOut":
        return cls(
            id=cycle.id,
            group_id=cycle.group_id,
            label=cycle.label,
            period_start=cycle.period_start,
            period_end=cycle.period_end,
            total_amount_paise=cycle.total_amount,
            total_amount_rupees=paise_to_rupees(cycle.total_amount),
            due_date=cycle.due_date,
            status=cycle.status,
            created_at=cycle.created_at,
        )


class RentAssignmentOut(BaseModel):
    id: uuid.UUID
    cycle_id: uuid.UUID
    member_id: uuid.UUID
    member_name: str
    assigned_amount_paise: int
    assigned_amount_rupees: float
    split_type: str
    notes: Optional[str] = None

    model_config = {"from_attributes": True}
