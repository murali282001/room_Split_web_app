import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Request, Response, Cookie, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_redis, get_current_active_user
from app.models.user import User
from app.schemas.auth import OTPRequest, OTPVerify, TokenResponse
from app.schemas.user import UserOut, UserUpdate
from app.schemas.common import MessageResponse
from app.services import auth_service
from app.utils.security import decode_token, hash_token
from app.utils.exceptions import UnauthorizedError
from app.config import settings
from jose import JWTError

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.post("/otp/request", response_model=MessageResponse)
async def request_otp(
    body: OTPRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """Request an OTP to be sent to the given phone number."""
    result = await auth_service.request_otp(body.phone, db, redis)
    return result


@router.post("/otp/verify")
async def verify_otp(
    body: OTPVerify,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """
    Verify OTP and return access token.
    Sets refresh token as an httpOnly cookie.
    """
    result = await auth_service.verify_otp_and_login(
        phone=body.phone,
        otp_code=body.otp,
        db=db,
        redis=redis,
        request=request,
    )

    # Set refresh token as httpOnly cookie
    refresh_max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    response.set_cookie(
        key="refresh_token",
        value=result["refresh_token"],
        httponly=True,
        secure=settings.APP_ENV == "production",
        samesite="lax",
        max_age=refresh_max_age,
        path="/api/v1/auth",
    )

    return {
        "access_token": result["access_token"],
        "token_type": "bearer",
        "user": result["user"],
        "is_new_user": result["is_new_user"],
    }


@router.post("/token/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token: Optional[str] = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """
    Read refresh token from httpOnly cookie and return a new access token.
    """
    if not refresh_token:
        raise UnauthorizedError("No refresh token provided")

    result = await auth_service.refresh_access_token(refresh_token, db, redis)
    return result


@router.post("/logout", response_model=MessageResponse)
async def logout(
    response: Response,
    refresh_token: Optional[str] = Cookie(default=None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """Revoke current session and clear the refresh token cookie."""
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            session_id = payload.get("sid")
            if session_id:
                await auth_service.logout(session_id, db)
        except JWTError:
            pass  # Token invalid — still clear cookie

    # Clear the refresh token cookie
    response.delete_cookie(key="refresh_token", path="/api/v1/auth")

    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_active_user)):
    """Get current authenticated user profile."""
    return UserOut.model_validate(current_user)


@router.put("/me", response_model=UserOut)
async def update_me(
    body: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user profile (name, upi_id, avatar_url)."""
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    await db.flush()
    return UserOut.model_validate(current_user)
