import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Boolean, Text, DateTime, Integer, ForeignKey, Enum, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import TimestampMixin
import enum


class CycleType(str, enum.Enum):
    monthly = "monthly"
    custom = "custom"


class Group(TimestampMixin, Base):
    __tablename__ = "groups"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    rent_collection_upi: Mapped[str] = mapped_column(String(100), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    cycle_type: Mapped[str] = mapped_column(
        Enum("monthly", "custom", name="cycletype_enum"),
        default="monthly",
        nullable=False,
    )
    cycle_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    invite_code: Mapped[str] = mapped_column(String(12), unique=True, nullable=False, index=True)
    invite_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    auto_confirm_payments: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])  # noqa: F821
    memberships: Mapped[List["Membership"]] = relationship(  # noqa: F821
        "Membership", back_populates="group"
    )
    roles: Mapped[List["Role"]] = relationship("Role", back_populates="group")  # noqa: F821
    rent_cycles: Mapped[List["RentCycle"]] = relationship(  # noqa: F821
        "RentCycle", back_populates="group"
    )
    wallet: Mapped[Optional["GroupWallet"]] = relationship(  # noqa: F821
        "GroupWallet", back_populates="group", uselist=False
    )
