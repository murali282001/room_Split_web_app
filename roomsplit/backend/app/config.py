from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "RoomSplit"
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    DATABASE_URL: str = "postgresql+asyncpg://roomsplit:roomsplit@postgres:5432/roomsplit"
    DATABASE_URL_SYNC: str = "postgresql+psycopg2://roomsplit:roomsplit@postgres:5432/roomsplit"

    REDIS_URL: str = "redis://redis:6379/0"

    OTP_PROVIDER: str = "console"  # "console" or "twilio"
    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 3
    OTP_RATE_LIMIT_PER_10MIN: int = 3

    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None
    TWILIO_WHATSAPP_FROM: Optional[str] = None  # e.g. +14155238886 (Twilio sandbox)

    NOTIFICATION_WHATSAPP: bool = False  # also deliver notifications via WhatsApp

    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:80"]

    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
