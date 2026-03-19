import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint, Enum, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_membership_group_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    invited_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        Enum("active", "suspended", "left", name="membership_status_enum"),
        default="active",
        nullable=False,
    )
    left_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    # Relationships
    group: Mapped["Group"] = relationship("Group", back_populates="memberships")  # noqa: F821
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", foreign_keys=[user_id], back_populates="memberships"
    )
    role: Mapped["Role"] = relationship("Role", back_populates="memberships")  # noqa: F821
    inviter: Mapped[Optional["User"]] = relationship(  # noqa: F821
        "User", foreign_keys=[invited_by]
    )
