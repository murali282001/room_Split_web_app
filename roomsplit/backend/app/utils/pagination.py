from pydantic import BaseModel, field_validator
from typing import TypeVar, Generic, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class PaginationParams(BaseModel):
    page: int = 1
    page_size: int = 20

    @field_validator("page")
    @classmethod
    def page_must_be_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("page must be >= 1")
        return v

    @field_validator("page_size")
    @classmethod
    def page_size_must_be_valid(cls, v: int) -> int:
        if v < 1:
            raise ValueError("page_size must be >= 1")
        if v > 100:
            raise ValueError("page_size must be <= 100")
        return v


async def paginate(
    db: AsyncSession,
    query,
    page: int,
    page_size: int,
) -> dict:
    """
    Paginate a SQLAlchemy select query.
    Returns dict with items, total, page, pages.
    """
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Fetch page
    offset = (page - 1) * page_size
    paginated_query = query.offset(offset).limit(page_size)
    result = await db.execute(paginated_query)
    items = result.scalars().all()

    pages = max(1, (total + page_size - 1) // page_size)

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": pages,
    }
