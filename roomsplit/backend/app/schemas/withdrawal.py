import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.utils.currency import paise_to_rupees


class WithdrawalCreate(BaseModel):
    amount: float  # rupees — converted to paise in service
    reason: Optional[str] = None


class WithdrawalOut(BaseModel):
    id: uuid.UUID
    amount_paise: int
    amount_rupees: float
    destination_upi: str
    reason: Optional[str] = None
    status: str
    requested_by_name: str
    approved_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    upi_ref: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
