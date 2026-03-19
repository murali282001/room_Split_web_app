import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import BigInteger, DateTime, ForeignKey, Enum, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False, index=True
    )
    # Denormalized — no FK constraints intentionally
    payment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True
    )
    withdrawal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True
    )
    transaction_type: Mapped[str] = mapped_column(
        Enum("credit", "debit", name="wallet_tx_type_enum"),
        nullable=False,
    )
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)  # paise
    balance_after: Mapped[int] = mapped_column(BigInteger, nullable=False)  # snapshot paise
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    # Denormalized — no FK constraint intentionally
    created_by: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
