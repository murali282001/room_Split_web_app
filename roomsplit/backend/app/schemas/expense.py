import uuid
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel
from app.utils.currency import paise_to_rupees


class ExpenseSplitInput(BaseModel):
    member_id: uuid.UUID
    amount: float  # rupees — converted to paise in service


class ExpenseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    total_amount: float  # rupees — converted to paise in service
    split_type: str = "equal"
    expense_date: date
    members: Optional[List[ExpenseSplitInput]] = None  # only for custom split


class ExpenseSplitOut(BaseModel):
    id: uuid.UUID
    member_id: uuid.UUID
    member_name: str = ""
    owed_amount_paise: int
    owed_amount_rupees: float
    paid_amount_paise: int
    paid_amount_rupees: float
    is_settled: bool

    model_config = {"from_attributes": True}


class ExpenseOut(BaseModel):
    id: uuid.UUID
    title: str
    category: Optional[str] = None
    total_amount_paise: int
    total_amount_rupees: float
    split_type: str
    expense_date: date
    status: str
    created_at: datetime
    splits: List[ExpenseSplitOut] = []

    model_config = {"from_attributes": True}
