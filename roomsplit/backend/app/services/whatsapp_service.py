import asyncio
import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)


def _get_twilio_client():
    from twilio.rest import Client
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        raise ValueError("Twilio credentials not configured")
    return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


async def send_whatsapp(to_phone: str, message: str) -> bool:
    """
    Send a WhatsApp message via Twilio.
    `to_phone` should be in E.164 format e.g. +919876543210
    Returns True on success, False on failure (non-raising).
    """
    if not settings.TWILIO_WHATSAPP_FROM:
        logger.warning("[WhatsApp] TWILIO_WHATSAPP_FROM not set — skipping")
        return False

    from_wa = f"whatsapp:{settings.TWILIO_WHATSAPP_FROM}"
    to_wa = f"whatsapp:{to_phone}"

    try:
        client = _get_twilio_client()
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: client.messages.create(
                body=message,
                from_=from_wa,
                to=to_wa,
            ),
        )
        logger.info(f"[WhatsApp] Message sent to {to_phone}")
        return True
    except Exception as e:
        logger.error(f"[WhatsApp] Failed to send to {to_phone}: {e}")
        return False
