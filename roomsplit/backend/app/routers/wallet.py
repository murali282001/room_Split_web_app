import uuid
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.wallet import WalletOut, WalletTransactionOut
from app.schemas.common import PaginatedResponse
from app.services import wallet_service
from app.utils.currency import paise_to_rupees

router = APIRouter(prefix="/api/v1/groups/{group_id}/wallet", tags=["Wallet"])


@router.get("")
async def get_wallet(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get wallet balance and summary for the group."""
    return await wallet_service.get_wallet_summary(group_id, db)


@router.get("/transactions")
async def list_transactions(
    group_id: uuid.UUID,
    transaction_type: Optional[str] = Query(default=None, description="Filter by 'credit' or 'debit'"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Paginated wallet transaction ledger for the group."""
    result = await wallet_service.get_transactions(
        group_id=group_id,
        db=db,
        page=page,
        page_size=page_size,
        transaction_type=transaction_type,
    )

    # Convert items to response format
    items = [
        WalletTransactionOut(
            id=tx.id,
            transaction_type=tx.transaction_type,
            amount_paise=tx.amount,
            amount_rupees=paise_to_rupees(tx.amount),
            balance_after_paise=tx.balance_after,
            balance_after_rupees=paise_to_rupees(tx.balance_after),
            description=tx.description,
            created_at=tx.created_at,
        )
        for tx in result["items"]
    ]

    return {
        "items": items,
        "total": result["total"],
        "page": result["page"],
        "pages": result["pages"],
    }
