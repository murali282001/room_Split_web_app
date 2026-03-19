import uuid
from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Enum, Text, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import TimestampMixin


class Expense(TimestampMixin, Base):
    __tablename__ = "expenses"

    group_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    total_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)  # paise
    split_type: Mapped[str] = mapped_column(
        Enum("equal", "custom", name="expense_split_type_enum"),
        default="equal",
        nullable=False,
    )
    receipt_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("draft", "active", "settled", name="expense_status_enum"),
        default="active",
        nullable=False,
    )

    # Relationships
    creator: Mapped["User"] = relationship("User")  # noqa: F821
    splits: Mapped[List["ExpenseSplit"]] = relationship(  # noqa: F821
        "ExpenseSplit", back_populates="expense"
    )
