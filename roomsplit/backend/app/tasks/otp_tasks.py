import asyncio
import logging
from datetime import datetime, timezone

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Helper to run an async coroutine from a sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="app.tasks.otp_tasks.cleanup_expired_otps")
def cleanup_expired_otps():
    """
    Hourly task: delete OTP tokens that have expired (expires_at < now).
    This keeps the otp_tokens table lean.
    """
    async def _run():
        from app.database import AsyncSessionLocal
        from app.models.otp_token import OTPToken
        from sqlalchemy import delete

        now = datetime.now(timezone.utc)

        async with AsyncSessionLocal() as db:
            try:
                result = await db.execute(
                    delete(OTPToken).where(OTPToken.expires_at < now)
                )
                deleted_count = result.rowcount
                await db.commit()
                logger.info(f"[Celery] Cleaned up {deleted_count} expired OTP tokens")
                return deleted_count
            except Exception as exc:
                await db.rollback()
                logger.error(f"[Celery] Error cleaning up expired OTPs: {exc}", exc_info=True)
                raise

    return _run_async(_run())
