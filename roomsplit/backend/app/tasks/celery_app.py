from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "roomsplit",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.reminder_tasks",
        "app.tasks.otp_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    # Beat schedule for periodic tasks
    beat_schedule={
        "expire-overdue-payments-daily": {
            "task": "app.tasks.reminder_tasks.expire_overdue_payments_task",
            "schedule": crontab(hour=0, minute=0),  # Daily at midnight IST
        },
        "send-payment-reminders-daily": {
            "task": "app.tasks.reminder_tasks.send_payment_reminders",
            "schedule": crontab(hour=9, minute=0),  # Daily at 9 AM IST
        },
        "cleanup-expired-otps-hourly": {
            "task": "app.tasks.otp_tasks.cleanup_expired_otps",
            "schedule": crontab(minute=0),  # Every hour
        },
    },
)
