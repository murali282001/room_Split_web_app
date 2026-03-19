import re
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.config import settings
from app.models.otp_token import OTPToken
from app.models.user import User
from app.models.session import Session
from app.utils.security import (
    generate_otp,
    hash_otp,
    verify_otp,
    hash_token,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.utils.exceptions import UnauthorizedError
from app.middleware.rate_limiter import check_otp_rate_limit
from app.services.otp_service import get_otp_provider
from app.schemas.user import UserOut
from jose import JWTError

logger = logging.getLogger(__name__)

PHONE_REGEX = re.compile(r"^\+91[6-9]\d{9}$")


def _validate_phone(phone: str) -> None:
    if not PHONE_REGEX.match(phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone format. Expected +91 followed by a 10-digit Indian mobile number.",
        )


async def request_otp(phone: str, db: AsyncSession, redis) -> dict:
    """
    1. Validate phone format
    2. Check rate limit
    3. Generate 6-digit OTP
    4. Hash with bcrypt
    5. Invalidate any existing unused OTP for this phone
    6. Insert new OTPToken
    7. Send via provider
    """
    _validate_phone(phone)
    await check_otp_rate_limit(phone, redis)

    otp = generate_otp()
    otp_hash = hash_otp(otp)

    # Invalidate existing unused OTPs for this phone
    now = datetime.now(timezone.utc)
    await db.execute(
        update(OTPToken)
        .where(
            OTPToken.phone == phone,
            OTPToken.used_at.is_(None),
            OTPToken.expires_at > now,
        )
        .values(used_at=now)
    )

    # Create new OTP token
    expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    token = OTPToken(
        phone=phone,
        otp_hash=otp_hash,
        attempts=0,
        expires_at=expires_at,
    )
    db.add(token)
    await db.flush()

    # Send OTP
    provider = get_otp_provider()
    await provider.send_otp(phone, otp)

    return {"message": "OTP sent successfully"}


async def verify_otp_and_login(
    phone: str,
    otp_code: str,
    db: AsyncSession,
    redis,
    request: Optional[Request] = None,
) -> dict:
    """
    1. Find latest unused, unexpired OTPToken
    2. Check attempts
    3. Verify OTP
    4. Mark used
    5. Get or create User
    6. Create Session and tokens
    7. Return tokens + user info
    """
    _validate_phone(phone)
    now = datetime.now(timezone.utc)

    # Find latest valid OTP for this phone
    result = await db.execute(
        select(OTPToken)
        .where(
            OTPToken.phone == phone,
            OTPToken.used_at.is_(None),
            OTPToken.expires_at > now,
        )
        .order_by(OTPToken.created_at.desc())
        .limit(1)
    )
    token = result.scalar_one_or_none()

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP not found or expired. Please request a new one.",
        )

    # Increment attempts
    token.attempts += 1

    if token.attempts > settings.OTP_MAX_ATTEMPTS:
        token.used_at = now  # Invalidate
        await db.flush()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum OTP attempts exceeded. Please request a new OTP.",
        )

    # Verify OTP
    if not verify_otp(otp_code, token.otp_hash):
        await db.flush()
        remaining = settings.OTP_MAX_ATTEMPTS - token.attempts
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OTP. {remaining} attempt(s) remaining.",
        )

    # Mark as used
    token.used_at = now
    await db.flush()

    # Get or create User
    user_result = await db.execute(select(User).where(User.phone == phone))
    user = user_result.scalar_one_or_none()
    is_new_user = False

    if user is None:
        is_new_user = True
        user = User(phone=phone, name=phone)  # Name defaults to phone; user can update later
        db.add(user)
        await db.flush()

    # Build device info from request
    device_info = {}
    if request:
        device_info = {
            "user_agent": request.headers.get("user-agent", ""),
            "ip": request.client.host if request.client else None,
        }

    # Create session
    session_id = str(uuid.uuid4())
    refresh_token_str = create_refresh_token(str(user.id), session_id)
    token_hash = hash_token(refresh_token_str)

    session_expires = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    session = Session(
        id=uuid.UUID(session_id),
        user_id=user.id,
        token_hash=token_hash,
        device_info=device_info,
        expires_at=session_expires,
    )
    db.add(session)
    await db.flush()

    access_token = create_access_token(str(user.id))

    return {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "user": UserOut.model_validate(user),
        "is_new_user": is_new_user,
    }


async def refresh_access_token(refresh_token_str: str, db: AsyncSession, redis) -> dict:
    """
    Decode refresh JWT, verify session is not revoked, return new access_token.
    """
    credentials_exception = UnauthorizedError("Invalid or expired refresh token")

    try:
        payload = decode_token(refresh_token_str)
        if payload.get("type") != "refresh":
            raise credentials_exception
        user_id: str = payload.get("sub")
        session_id: str = payload.get("sid")
        if not user_id or not session_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Look up session
    result = await db.execute(
        select(Session).where(
            Session.id == uuid.UUID(session_id),
            Session.revoked_at.is_(None),
        )
    )
    session = result.scalar_one_or_none()

    if session is None:
        raise credentials_exception

    now = datetime.now(timezone.utc)
    if session.expires_at.replace(tzinfo=timezone.utc) < now:
        raise credentials_exception

    # Verify token hash matches
    token_hash = hash_token(refresh_token_str)
    if session.token_hash != token_hash:
        raise credentials_exception

    new_access_token = create_access_token(user_id)
    return {"access_token": new_access_token, "token_type": "bearer"}


async def logout(session_id: str, db: AsyncSession) -> None:
    """Revoke a session by setting revoked_at = now."""
    now = datetime.now(timezone.utc)
    await db.execute(
        update(Session)
        .where(Session.id == uuid.UUID(session_id))
        .values(revoked_at=now)
    )
