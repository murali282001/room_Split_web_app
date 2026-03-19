import uuid
from datetime import datetime
from sqlalchemy import BigInteger, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class GroupWallet(Base):
    __tablename__ = "group_wallet"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("groups.id"), unique=True, nullable=False, index=True
    )
    balance: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)  # paise
    last_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    version: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)

    # Relationships
    group: Mapped["Group"] = relationship("Group", back_populates="wallet")  # noqa: F821
