from typing import AsyncGenerator
from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import redis.asyncio as aioredis
from jose import JWTError

from app.database import get_db, AsyncSessionLocal
from app.config import settings
from app.utils.security import decode_token, hash_token
from app.utils.exceptions import UnauthorizedError
from app.models.session import Session
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/otp/verify")

# Re-export get_db for convenience
__all__ = ["get_db", "get_redis", "get_current_user", "get_current_active_user"]


async def get_redis() -> AsyncGenerator:
    """Yields an async Redis client."""
    client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
) -> User:
    """
    Decodes the JWT access token, validates session is not revoked,
    and returns the User ORM object.
    """
    credentials_exception = UnauthorizedError("Could not validate credentials")

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credentials_exception
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Check token is not blacklisted in Redis (for logout before expiry)
    token_hash = hash_token(token)
    blacklisted = await redis.get(f"blacklist:{token_hash}")
    if blacklisted:
        raise credentials_exception

    # Fetch user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Wraps get_current_user and additionally checks user.is_active."""
    if not current_user.is_active:
        raise UnauthorizedError("Inactive user account")
    return current_user
