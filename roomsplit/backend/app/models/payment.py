import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Enum, Text, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import TimestampMixin


class Payment(TimestampMixin, Base):
    __tablename__ = "payments"

    group_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False, index=True
    )
    cycle_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("rent_cycles.id"), nullable=True, index=True
    )
    assignment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("rent_assignments.id"), nullable=True
    )
    payer_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    payee_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)  # paise
    upi_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    payment_type: Mapped[str] = mapped_column(
        Enum("rent", "expense", "withdrawal", name="payment_type_enum"),
        default="rent",
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        Enum(
            "pending",
            "marked_paid",
            "confirmed",
            "rejected",
            "expired",
            name="payment_status_enum",
        ),
        default="pending",
        nullable=False,
        index=True,
    )
    marked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    confirmed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    rejected_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejected_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Relationships
    group: Mapped["Group"] = relationship("Group")  # noqa: F821
    cycle: Mapped[Optional["RentCycle"]] = relationship(  # noqa: F821
        "RentCycle", back_populates="payments"
    )
    assignment: Mapped[Optional["RentAssignment"]] = relationship("RentAssignment")  # noqa: F821
    payer: Mapped["User"] = relationship("User", foreign_keys=[payer_id])  # noqa: F821
    payee: Mapped["User"] = relationship("User", foreign_keys=[payee_id])  # noqa: F821
    confirmer: Mapped[Optional["User"]] = relationship(  # noqa: F821
        "User", foreign_keys=[confirmed_by]
    )
    rejecter: Mapped[Optional["User"]] = relationship(  # noqa: F821
        "User", foreign_keys=[rejected_by]
    )
