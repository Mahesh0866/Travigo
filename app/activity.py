"""
activity.py — Activity / Audit Log system for Travigo Admin Panel.

Provides:
  - log_activity()       : async helper called from all other routes to write audit entries
  - GET /api/admin/activity       : paginated activity log with filters
  - GET /api/admin/activity/stats : enhanced dashboard stats (users, searches, revenue)
  - GET /api/admin/users          : list all registered users

Action constants mirror what the admin sees in the Activity Log tab.
"""
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.database import get_db, ActivityLog, User, Booking, TravelPackage
from app.admin_auth import get_current_admin_jwt

logger = logging.getLogger("travigo_activity")
router = APIRouter()


# ── Action Constants ─────────────────────────────────────────────────────────
# These are stored in activity_logs.action column.
# Keep them UPPER_SNAKE_CASE so the frontend can map them to icons/labels.

class Actions:
    USER_REGISTERED         = "USER_REGISTERED"
    USER_LOGIN              = "USER_LOGIN"
    USER_SEARCH             = "USER_SEARCH"
    USER_VIEW_PACKAGE       = "USER_VIEW_PACKAGE"
    USER_BOOKING_REQUESTED  = "USER_BOOKING_REQUESTED"
    ADMIN_APPROVED_BOOKING  = "ADMIN_APPROVED_BOOKING"
    ADMIN_REJECTED_BOOKING  = "ADMIN_REJECTED_BOOKING"
    USER_BOOKED             = "USER_BOOKED"
    USER_CANCELLED_BOOKING  = "USER_CANCELLED_BOOKING"
    PAYMENT_METHOD_SELECTED = "PAYMENT_METHOD_SELECTED"
    PAYMENT_SUBMITTED       = "PAYMENT_SUBMITTED"
    PAYMENT_DEADLINE_EXPIRED = "PAYMENT_DEADLINE_EXPIRED"
    ADMIN_CONFIRMED_PAYMENT = "ADMIN_CONFIRMED_PAYMENT"
    ADMIN_REJECTED_PAYMENT  = "ADMIN_REJECTED_PAYMENT"
    ADMIN_CANCELLED_BOOKING = "ADMIN_CANCELLED_BOOKING"
    ADMIN_RESET_BOOKING     = "ADMIN_RESET_BOOKING"
    ADMIN_CREATED_PACKAGE   = "ADMIN_CREATED_PACKAGE"
    ADMIN_UPDATED_PACKAGE   = "ADMIN_UPDATED_PACKAGE"
    ADMIN_CHANGED_PKG_STATUS = "ADMIN_CHANGED_PKG_STATUS"
    ADMIN_UPDATED_UPI       = "ADMIN_UPDATED_UPI"
    ADMIN_CHANGED_CODE      = "ADMIN_CHANGED_CODE"
    SYSTEM_BOOKING_EXPIRED  = "SYSTEM_BOOKING_EXPIRED"


# ── Core Logging Helper ───────────────────────────────────────────────────────

async def log_activity(
    db: AsyncSession,
    action: str,
    detail: str,
    actor_type: str = "system",
    user_id: Optional[int] = None,
    metadata: Optional[dict] = None,
):
    """
    Write one entry to the activity_logs table.
    Call this from any route handler after a significant action.

    Args:
        db         : the current database session
        action     : one of the Actions.* constants
        detail     : human-readable description shown in the log
        actor_type : "user" | "admin" | "system"
        user_id    : the User.id if actor_type == "user"
        metadata   : optional dict of extra structured data (serialised to JSON)
    """
    try:
        entry = ActivityLog(
            user_id=user_id,
            actor_type=actor_type,
            action=action,
            detail=detail,
            metadata_json=json.dumps(metadata) if metadata else None,
            created_at=datetime.utcnow(),
        )
        db.add(entry)
        # Flush without committing — the caller's own commit will persist this too.
        await db.flush()
    except Exception as exc:
        # Never let logging failures crash the main request
        logger.error(f"Failed to write activity log [{action}]: {exc}")


# ── Admin Routes ─────────────────────────────────────────────────────────────

@router.get("/admin/activity")
async def get_activity_log(
    action: Optional[str] = Query(None, description="Filter by action type"),
    actor_type: Optional[str] = Query(None, description="Filter by actor: user|admin|system"),
    user_id: Optional[int] = Query(None, description="Filter by user_id"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """Admin: paginated activity/audit log with optional filters."""
    stmt = select(ActivityLog).order_by(ActivityLog.created_at.desc())

    if action:
        stmt = stmt.where(ActivityLog.action == action)
    if actor_type:
        stmt = stmt.where(ActivityLog.actor_type == actor_type)
    if user_id:
        stmt = stmt.where(ActivityLog.user_id == user_id)

    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    logs = result.scalars().all()

    # Enrich with user info
    output = []
    for log in logs:
        entry = {
            "id": log.id,
            "user_id": log.user_id,
            "actor_type": log.actor_type,
            "action": log.action,
            "detail": log.detail,
            "metadata": json.loads(log.metadata_json) if log.metadata_json else None,
            "created_at": log.created_at,
        }
        output.append(entry)

    return {"logs": output, "total": len(output), "offset": offset, "limit": limit}


@router.get("/admin/activity/stats")
async def get_enhanced_stats(
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """Admin: enhanced dashboard statistics including users, searches and revenue."""

    # --- User stats ---
    user_result = await db.execute(select(User))
    users = user_result.scalars().all()
    total_users = len(users)

    # --- Activity log counts ---
    def _count(action_name: str, logs: list) -> int:
        return sum(1 for l in logs if l.action == action_name)

    log_result = await db.execute(select(ActivityLog))
    all_logs = log_result.scalars().all()

    total_logins    = _count(Actions.USER_LOGIN, all_logs)
    total_searches  = _count(Actions.USER_SEARCH, all_logs)
    total_registrations = _count(Actions.USER_REGISTERED, all_logs)
    pkg_views       = _count(Actions.USER_VIEW_PACKAGE, all_logs)

    # --- Package stats ---
    pkg_result = await db.execute(select(TravelPackage))
    packages = pkg_result.scalars().all()
    total_packages    = len(packages)
    active_packages   = sum(1 for p in packages if p.status == "ACTIVE")
    inactive_packages = sum(1 for p in packages if p.status == "INACTIVE")
    cancelled_packages = sum(1 for p in packages if p.status == "CANCELLED")
    available_seats   = sum(p.available_seats for p in packages if p.status == "ACTIVE")

    # --- Booking stats ---
    booking_result = await db.execute(select(Booking))
    bookings = booking_result.scalars().all()
    total_bookings          = len(bookings)
    pending_admin_approval  = sum(1 for b in bookings if b.status == "PENDING_ADMIN_APPROVAL")
    approved_bookings       = sum(1 for b in bookings if b.status == "APPROVED")
    rejected_bookings       = sum(1 for b in bookings if b.status == "REJECTED")
    pending_payments        = sum(1 for b in bookings if b.status in ("PENDING_PAYMENT", "PAYMENT_VERIFICATION"))
    confirmed_bookings      = sum(1 for b in bookings if b.status == "CONFIRMED")
    expired_bookings        = sum(1 for b in bookings if b.status == "EXPIRED")
    cancelled_bookings      = sum(1 for b in bookings if b.status == "CANCELLED")
    cash_bookings           = sum(1 for b in bookings if b.payment_method == "CASH")
    upi_bookings            = sum(1 for b in bookings if b.payment_method == "UPI")
    total_revenue           = sum(b.total_amount for b in bookings if b.status == "CONFIRMED")
    total_travelers         = sum(b.num_travelers for b in bookings if b.status == "CONFIRMED")

    return {
        # Users
        "total_users": total_users,
        "total_registrations": total_registrations,
        "total_logins": total_logins,
        "total_searches": total_searches,
        "package_views": pkg_views,
        # Packages
        "total_packages": total_packages,
        "active_packages": active_packages,
        "inactive_packages": inactive_packages,
        "cancelled_packages": cancelled_packages,
        "available_seats": available_seats,
        # Bookings
        "total_bookings": total_bookings,
        "pending_admin_approval": pending_admin_approval,
        "approved_bookings": approved_bookings,
        "rejected_bookings": rejected_bookings,
        "pending_payments": pending_payments,
        "confirmed_bookings": confirmed_bookings,
        "expired_bookings": expired_bookings,
        "cancelled_bookings": cancelled_bookings,
        "cash_bookings": cash_bookings,
        "upi_bookings": upi_bookings,
        # Revenue
        "total_revenue": round(total_revenue, 2),
        "total_travelers": total_travelers,
    }


@router.get("/admin/users")
async def get_all_users(
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """Admin: list all registered users (no passwords returned)."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "mobile": u.mobile,
            "is_admin": u.is_admin,
            "created_at": u.created_at,
        }
        for u in users
    ]
