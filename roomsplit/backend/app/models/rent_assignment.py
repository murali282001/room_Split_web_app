import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import BigInteger, DateTime, ForeignKey, Enum, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import TimestampMixin


class RentAssignment(TimestampMixin, Base):
    __tablename__ = "rent_assignments"

    cycle_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("rent_cycles.id"), nullable=False, index=True
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    assigned_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)  # paise
    split_type: Mapped[str] = mapped_column(
        Enum("equal", "custom", "percentage", name="split_type_enum"),
        default="equal",
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    cycle: Mapped["RentCycle"] = relationship("RentCycle", back_populates="assignments")  # noqa: F821
    member: Mapped["User"] = relationship("User")  # noqa: F821
