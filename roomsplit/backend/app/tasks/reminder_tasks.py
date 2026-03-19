import asyncio
import logging
from datetime import date, timedelta

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Helper to run an async coroutine from a sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="app.tasks.reminder_tasks.expire_overdue_payments_task")
def expire_overdue_payments_task():
    """
    Daily task: expire all pending payments where due_date < today - 7 days.
    """
    async def _run():
        from app.database import AsyncSessionLocal
        from app.services.payment_service import expire_overdue_payments

        async with AsyncSessionLocal() as db:
            try:
                count = await expire_overdue_payments(db)
                await db.commit()
                logger.info(f"[Celery] Expired {count} overdue payments")
                return count
            except Exception as exc:
                await db.rollback()
                logger.error(f"[Celery] Error expiring overdue payments: {exc}", exc_info=True)
                raise

    return _run_async(_run())


@celery_app.task(name="app.tasks.reminder_tasks.send_payment_reminders")
def send_payment_reminders():
    """
    Daily task: find active cycles where due_date is tomorrow,
    notify unpaid members with a payment reminder.
    """
    async def _run():
        from app.database import AsyncSessionLocal
        from app.models.rent_cycle import RentCycle
        from app.models.payment import Payment
        from app.services.notification_service import create_notification
        from app.utils.currency import paise_to_rupees
        from sqlalchemy import select

        tomorrow = date.today() + timedelta(days=1)

        async with AsyncSessionLocal() as db:
            try:
                # Find active cycles with due_date = tomorrow
                cycles_result = await db.execute(
                    select(RentCycle).where(
                        RentCycle.status == "active",
                        RentCycle.due_date == tomorrow,
                    )
                )
                cycles = cycles_result.scalars().all()
                reminder_count = 0

                for cycle in cycles:
                    # Find pending payments for this cycle
                    payments_result = await db.execute(
                        select(Payment).where(
                            Payment.cycle_id == cycle.id,
                            Payment.status == "pending",
                        )
                    )
                    pending_payments = payments_result.scalars().all()

                    for payment in pending_payments:
                        await create_notification(
                            user_id=payment.payer_id,
                            group_id=cycle.group_id,
                            type="payment_reminder",
                            title="Rent Due Tomorrow",
                            body=(
                                f"Your rent payment of \u20b9{paise_to_rupees(payment.amount):,.2f} "
                                f"for {cycle.label} is due tomorrow ({tomorrow}). Please pay today!"
                            ),
                            data={
                                "payment_id": str(payment.id),
                                "cycle_id": str(cycle.id),
                                "due_date": tomorrow.isoformat(),
                            },
                            db=db,
                        )
                        reminder_count += 1

                await db.commit()
                logger.info(f"[Celery] Sent {reminder_count} payment reminders for due_date={tomorrow}")
                return reminder_count

            except Exception as exc:
                await db.rollback()
                logger.error(f"[Celery] Error sending payment reminders: {exc}", exc_info=True)
                raise

    return _run_async(_run())
