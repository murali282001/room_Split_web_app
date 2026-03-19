import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ExpenseSplit(Base):
    __tablename__ = "expense_splits"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    expense_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("expenses.id"), nullable=False, index=True
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    owed_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)  # paise
    paid_amount: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)  # paise
    payment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("payments.id"), nullable=True
    )
    is_settled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    expense: Mapped["Expense"] = relationship("Expense", back_populates="splits")  # noqa: F821
    member: Mapped["User"] = relationship("User")  # noqa: F821
    payment: Mapped[Optional["Payment"]] = relationship("Payment")  # noqa: F821
