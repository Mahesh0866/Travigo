"""
scheduler.py — Server-side background task to automatically expire
PENDING_PAYMENT bookings that have passed their payment_deadline.

Runs every 60 seconds inside the FastAPI lifespan context.
Works even when users close the browser.
"""
import asyncio
import logging
from datetime import datetime

logger = logging.getLogger("travigo_scheduler")


async def expire_pending_bookings():
    """Continuous background loop: expire overdue PENDING_PAYMENT bookings."""
    from app.database import AsyncSessionLocal, Booking, TravelPackage
    from sqlalchemy.future import select

    while True:
        try:
            await asyncio.sleep(60)  # check every 60 seconds
            async with AsyncSessionLocal() as session:
                now = datetime.utcnow()
                # Find all PENDING_PAYMENT bookings past their deadline
                result = await session.execute(
                    select(Booking).where(
                        Booking.status == "PENDING_PAYMENT",
                        Booking.payment_deadline <= now,
                    )
                )
                expired_bookings = result.scalars().all()

                if expired_bookings:
                    logger.info(f"Scheduler: expiring {len(expired_bookings)} overdue booking(s).")

                for booking in expired_bookings:
                    booking.status = "EXPIRED"
                    booking.updated_at = now

                    # Release seats back to the package
                    pkg_result = await session.execute(
                        select(TravelPackage).where(TravelPackage.id == booking.package_id)
                    )
                    pkg = pkg_result.scalars().first()
                    if pkg:
                        pkg.available_seats += booking.num_travelers
                        pkg.updated_at = now

                    # Log the expiry to the audit trail
                    try:
                        from app.activity import log_activity, Actions
                        import json
                        from app.database import ActivityLog
                        entry = ActivityLog(
                            user_id=booking.user_id,
                            actor_type="system",
                            action=Actions.SYSTEM_BOOKING_EXPIRED,
                            detail=f"Payment deadline expired for booking #{booking.id} — seats released",
                            metadata_json=json.dumps({
                                "booking_id": booking.id,
                                "package_id": booking.package_id,
                                "num_travelers": booking.num_travelers,
                                "total_amount": booking.total_amount,
                            }),
                            created_at=now,
                        )
                        session.add(entry)
                    except Exception as log_exc:
                        logger.error(f"Failed to log booking expiry: {log_exc}")

                if expired_bookings:
                    await session.commit()

        except asyncio.CancelledError:
            logger.info("Scheduler task cancelled.")
            break
        except Exception as exc:
            logger.error(f"Scheduler error: {exc}", exc_info=True)
            # Don't stop the loop on non-fatal errors
