import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, func
from sqlalchemy.orm import mapped_column, MappedColumn
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


class TimestampMixin:
    """Mixin providing id, created_at, updated_at, deleted_at columns."""

    id: MappedColumn[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    created_at: MappedColumn[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: MappedColumn[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True,
    )
    deleted_at: MappedColumn[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
