from fastapi import HTTPException, status
from app.config import settings


async def check_otp_rate_limit(phone: str, redis_client) -> None:
    """
    Redis-backed OTP rate limiter.
    Key: otp:rate:{phone}
    Allows at most OTP_RATE_LIMIT_PER_10MIN requests in a 10-minute window.
    Raises HTTP 429 if the limit is exceeded.
    """
    key = f"otp:rate:{phone}"
    count = await redis_client.incr(key)

    if count == 1:
        # First request in window — set TTL of 600 seconds (10 minutes)
        await redis_client.expire(key, 600)

    if count > settings.OTP_RATE_LIMIT_PER_10MIN:
        ttl = await redis_client.ttl(key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Too many OTP requests. "
                f"Limit is {settings.OTP_RATE_LIMIT_PER_10MIN} per 10 minutes. "
                f"Try again in {ttl} seconds."
            ),
        )
