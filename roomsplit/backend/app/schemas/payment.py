import uuid
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel
from app.utils.currency import paise_to_rupees


class PaymentOut(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    cycle_id: Optional[uuid.UUID] = None
    payer_id: uuid.UUID
    payer_name: str
    amount_paise: int
    amount_rupees: float
    upi_ref: Optional[str] = None
    payment_type: str
    status: str
    due_date: Optional[date] = None
    marked_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MarkPaidRequest(BaseModel):
    upi_ref: str  # UTR/transaction reference entered by payer


class RejectRequest(BaseModel):
    rejection_reason: str


class UPILinkResponse(BaseModel):
    upi_link: str
    qr_code_base64: str
    amount_rupees: float
    payee_name: str
    payee_upi: str


class PaymentStatusSummary(BaseModel):
    total_assigned: int  # paise
    total_paid: int       # paise
    total_pending: int    # paise
    total_marked_for_confirmation: int  # paise
    count_overdue: int
