import logging
from abc import ABC, abstractmethod
from app.config import settings

logger = logging.getLogger(__name__)


class OTPProvider(ABC):
    @abstractmethod
    async def send_otp(self, phone: str, otp: str) -> None:
        """Send an OTP to the given phone number."""
        ...


class ConsoleOTPProvider(OTPProvider):
    """Development provider — prints OTP to stdout/log instead of sending SMS."""

    async def send_otp(self, phone: str, otp: str) -> None:
        logger.info(f"[OTP] {phone}: {otp}")
        print(f"[OTP] {phone}: {otp}", flush=True)


class TwilioOTPProvider(OTPProvider):
    """Production provider — sends OTP via Twilio SMS."""

    def __init__(self) -> None:
        from twilio.rest import Client

        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            raise ValueError(
                "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set when OTP_PROVIDER=twilio"
            )
        self._client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        self._from_number = settings.TWILIO_FROM_NUMBER

    async def send_otp(self, phone: str, otp: str) -> None:
        # Twilio client is synchronous; run in thread pool to avoid blocking event loop
        import asyncio

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self._client.messages.create(
                body=f"Your RoomSplit OTP is {otp}. Valid for {settings.OTP_EXPIRE_MINUTES} minutes. Do not share.",
                from_=self._from_number,
                to=phone,
            ),
        )
        logger.info(f"[OTP] SMS sent to {phone}")


class WhatsAppOTPProvider(OTPProvider):
    """Production provider — sends OTP via Twilio WhatsApp."""

    async def send_otp(self, phone: str, otp: str) -> None:
        from app.services.whatsapp_service import send_whatsapp
        message = (
            f"🔐 *RoomSplit OTP*\n\n"
            f"Your login code is: *{otp}*\n"
            f"Valid for {settings.OTP_EXPIRE_MINUTES} minutes.\n\n"
            f"Do not share this code with anyone."
        )
        sent = await send_whatsapp(phone, message)
        if not sent:
            raise RuntimeError(f"Failed to send WhatsApp OTP to {phone}")
        logger.info(f"[OTP] WhatsApp OTP sent to {phone}")


def get_otp_provider() -> OTPProvider:
    """Factory: returns the configured OTP provider."""
    if settings.OTP_PROVIDER == "whatsapp":
        return WhatsAppOTPProvider()
    if settings.OTP_PROVIDER == "twilio":
        return TwilioOTPProvider()
    return ConsoleOTPProvider()
