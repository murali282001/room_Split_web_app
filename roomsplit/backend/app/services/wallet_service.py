import uuid
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.wallet import GroupWallet
from app.models.wallet_transaction import WalletTransaction
from app.utils.exceptions import NotFoundError
from app.utils.pagination import paginate
from app.utils.currency import paise_to_rupees

logger = logging.getLogger(__name__)


async def get_wallet_summary(group_id: uuid.UUID, db: AsyncSession) -> dict:
    """Return balance, total_credited, total_debited, transaction_count for a group."""
    wallet_result = await db.execute(
        select(GroupWallet).where(GroupWallet.group_id == group_id)
    )
    wallet = wallet_result.scalar_one_or_none()
    if wallet is None:
        raise NotFoundError("Group wallet not found")

    # Aggregate credits and debits
    credit_result = await db.execute(
        select(func.coalesce(func.sum(WalletTransaction.amount), 0)).where(
            WalletTransaction.group_id == group_id,
            WalletTransaction.transaction_type == "credit",
        )
    )
    total_credited = credit_result.scalar_one()

    debit_result = await db.execute(
        select(func.coalesce(func.sum(WalletTransaction.amount), 0)).where(
            WalletTransaction.group_id == group_id,
            WalletTransaction.transaction_type == "debit",
        )
    )
    total_debited = debit_result.scalar_one()

    count_result = await db.execute(
        select(func.count(WalletTransaction.id)).where(
            WalletTransaction.group_id == group_id
        )
    )
    tx_count = count_result.scalar_one()

    return {
        "group_id": group_id,
        "balance_paise": wallet.balance,
        "balance_rupees": paise_to_rupees(wallet.balance),
        "total_credited_paise": total_credited,
        "total_credited_rupees": paise_to_rupees(total_credited),
        "total_debited_paise": total_debited,
        "total_debited_rupees": paise_to_rupees(total_debited),
        "transaction_count": tx_count,
        "last_updated_at": wallet.last_updated_at,
    }


async def get_transactions(
    group_id: uuid.UUID,
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    transaction_type: Optional[str] = None,
) -> dict:
    """Paginated wallet transactions for a group, newest first."""
    query = (
        select(WalletTransaction)
        .where(WalletTransaction.group_id == group_id)
        .order_by(WalletTransaction.created_at.desc())
    )

    if transaction_type:
        query = query.where(WalletTransaction.transaction_type == transaction_type)

    return await paginate(db, query, page, page_size)
