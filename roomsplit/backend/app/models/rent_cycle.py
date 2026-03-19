import uuid
from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import String, BigInteger, Date, DateTime, ForeignKey, Enum, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import TimestampMixin


class RentCycle(TimestampMixin, Base):
    __tablename__ = "rent_cycles"

    group_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    total_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)  # paise
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("draft", "active", "closed", "cancelled", name="cycle_status_enum"),
        default="draft",
        nullable=False,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    closed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    group: Mapped["Group"] = relationship("Group", back_populates="rent_cycles")  # noqa: F821
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])  # noqa: F821
    closer: Mapped[Optional["User"]] = relationship(  # noqa: F821
        "User", foreign_keys=[closed_by]
    )
    assignments: Mapped[List["RentAssignment"]] = relationship(  # noqa: F821
        "RentAssignment", back_populates="cycle"
    )
    payments: Mapped[List["Payment"]] = relationship(  # noqa: F821
        "Payment", back_populates="cycle"
    )
