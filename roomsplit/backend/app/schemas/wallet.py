import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.utils.currency import paise_to_rupees


class WalletOut(BaseModel):
    group_id: uuid.UUID
    balance_paise: int
    balance_rupees: float
    last_updated_at: datetime

    model_config = {"from_attributes": True}


class WalletTransactionOut(BaseModel):
    id: uuid.UUID
    transaction_type: str
    amount_paise: int
    amount_rupees: float
    balance_after_paise: int
    balance_after_rupees: float
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
