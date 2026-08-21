"""
bookings.py — FastAPI router for Booking + Payment workflow.

Public:
  GET  /api/settings/upi                       — UPI QR/ID for payment page

User (JWT required):
  POST /api/bookings                            — create booking
  GET  /api/bookings/my                         — user's bookings
  GET  /api/bookings/{id}                       — single booking

Admin (admin_jwt required):
  GET  /api/admin/bookings                      — all bookings
  POST /api/admin/bookings/{id}/confirm-payment — CONFIRMED
  POST /api/admin/bookings/{id}/reject-payment  — CANCELLED + seats released
  POST /api/admin/bookings/{id}/cancel          — CANCELLED + seats released
  POST /api/admin/bookings/{id}/reset           — PENDING_PAYMENT + new 5-hr window
  PUT  /api/admin/settings/upi                  — update UPI settings
"""
import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, Booking, TravelPackage, AppSettings, User
from app.models import (
    BookingCreate,
    BookingPaymentSubmit,
    AdminApprovalAction,
    AdminPaymentAction,
    AppSettingsUpdate,
    AppSettingsResponse,
)
from app.auth import get_current_user
from app.admin_auth import get_current_admin_jwt
from app.activity import log_activity, Actions

logger = logging.getLogger("travigo_bookings")
router = APIRouter()

PAYMENT_DEADLINE_HOURS = 5


# ── Helper ──────────────────────────────────────────────────────

def _booking_to_dict(booking: Booking) -> dict:
    return {
        "id": booking.id,
        "package_id": booking.package_id,
        "user_id": booking.user_id,
        "traveler_name": booking.traveler_name,
        "traveler_mobile": booking.traveler_mobile,
        "traveler_email": booking.traveler_email,
        "num_travelers": booking.num_travelers,
        "travel_date": booking.travel_date,
        "payment_method": booking.payment_method,
        "upi_transaction_id": booking.upi_transaction_id,
        "status": booking.status,
        "payment_deadline": booking.payment_deadline,
        "admin_note": booking.admin_note,
        "total_amount": booking.total_amount,
        "created_at": booking.created_at,
        "updated_at": booking.updated_at,
    }


async def _release_seats(db: AsyncSession, booking: Booking, now: datetime):
    """Release seats when a booking is cancelled/expired (only if seats were held)."""
    if booking.status in ("APPROVED", "PENDING_PAYMENT", "PAYMENT_VERIFICATION", "CONFIRMED"):
        pkg_result = await db.execute(
            select(TravelPackage).where(TravelPackage.id == booking.package_id)
        )
        pkg = pkg_result.scalars().first()
        if pkg:
            pkg.available_seats += booking.num_travelers
            pkg.updated_at = now


# ── Public Settings ─────────────────────────────────────────────

@router.get("/settings/upi")
async def get_upi_settings(db: AsyncSession = Depends(get_db)):
    """Return UPI ID and QR image URL (public)."""
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    s = result.scalars().first()
    if not s:
        return {"id": 1, "upi_id": "", "upi_qr_url": "", "updated_at": None}
    return {"id": s.id, "upi_id": s.upi_id, "upi_qr_url": s.upi_qr_url, "updated_at": s.updated_at}


@router.put("/admin/settings/upi")
async def update_upi_settings(
    data: AppSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """Admin: update UPI ID and QR image URL."""
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    s = result.scalars().first()
    now = datetime.utcnow()
    if not s:
        s = AppSettings(id=1, upi_id=data.upi_id, upi_qr_url=data.upi_qr_url, updated_at=now)
        db.add(s)
    else:
        s.upi_id = data.upi_id
        s.upi_qr_url = data.upi_qr_url
        s.updated_at = now
    await log_activity(
        db, action=Actions.ADMIN_UPDATED_UPI,
        detail=f"Admin updated UPI settings: ID={data.upi_id}",
        actor_type="admin",
        metadata={"upi_id": data.upi_id, "upi_qr_url": data.upi_qr_url},
    )
    await db.commit()
    await db.refresh(s)
    return {"id": s.id, "upi_id": s.upi_id, "upi_qr_url": s.upi_qr_url, "updated_at": s.updated_at}


@router.post("/admin/settings/upi/upload-qr")
async def upload_upi_qr_scanner(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """
    Admin: Upload/Update UPI QR Scanner Image (PNG, JPG, JPEG).
    Saves file securely in uploads/ directory and updates upi_qr_url in database.
    """
    allowed_exts = {".png", ".jpg", ".jpeg"}
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""

    if ext not in allowed_exts and file.content_type not in ("image/png", "image/jpeg", "image/jpg"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Please upload an image in PNG, JPG, or JPEG format."
        )

    os.makedirs("uploads", exist_ok=True)
    filename = f"upi_qr_{uuid.uuid4().hex[:8]}{ext or '.png'}"
    filepath = os.path.join("uploads", filename)

    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)
    
    BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")

    qr_url = f"{BASE_URL}/static/uploads/{filename}"

    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    s = result.scalars().first()
    now = datetime.utcnow()
    if not s:
        s = AppSettings(id=1, upi_id="", upi_qr_url=qr_url, updated_at=now)
        db.add(s)
    else:
        s.upi_qr_url = qr_url
        s.updated_at = now

    await log_activity(
        db, action=Actions.ADMIN_UPDATED_UPI,
        detail=f"Admin uploaded new UPI QR scanner image: {filename}",
        actor_type="admin",
        metadata={"filename": filename, "upi_qr_url": qr_url},
    )
    await db.commit()
    await db.refresh(s)
    return {
        "message": "UPI QR Scanner image uploaded successfully",
        "upi_id": s.upi_id,
        "upi_qr_url": s.upi_qr_url,
        "updated_at": s.updated_at
    }


# ── User Booking Routes ─────────────────────────────────────────

@router.post("/bookings", status_code=status.HTTP_201_CREATED)
async def create_booking(
    data: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    User: request a new booking for a travel package.
    Status starts at PENDING_ADMIN_APPROVAL.
    Seats are NOT held until Admin approves the request.
    """
    # Validate package
    pkg_result = await db.execute(
        select(TravelPackage).where(TravelPackage.id == data.package_id)
    )
    pkg = pkg_result.scalars().first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    if pkg.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Package is not available for booking")
    if pkg.available_seats < data.num_travelers:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough seats. Only {pkg.available_seats} seat(s) available."
        )

    now = datetime.utcnow()

    # Determine status and seat allocation based on payment method provided in 4-step flow
    if data.payment_method == "UPI":
        status_val = "PAYMENT_VERIFICATION"
        payment_deadline = None
        # Reserve seats for verification
        pkg.available_seats -= data.num_travelers
        pkg.updated_at = now
    elif data.payment_method == "CASH":
        status_val = "PENDING_PAYMENT"
        payment_deadline = now + timedelta(hours=PAYMENT_DEADLINE_HOURS)
        # Reserve seats for 5-hour cash payment window
        pkg.available_seats -= data.num_travelers
        pkg.updated_at = now
    else:
        status_val = "PENDING_ADMIN_APPROVAL"
        payment_deadline = None

    booking = Booking(
        package_id=data.package_id,
        user_id=current_user.id,
        traveler_name=data.traveler_name,
        traveler_mobile=data.traveler_mobile,
        traveler_email=data.traveler_email,
        num_travelers=data.num_travelers,
        travel_date=data.travel_date,
        payment_method=data.payment_method,
        upi_transaction_id=data.upi_transaction_id,
        status=status_val,
        payment_deadline=payment_deadline,
        total_amount=round(pkg.price * data.num_travelers, 2),
        created_at=now,
        updated_at=now,
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)

    # Log booking request
    action_type = Actions.PAYMENT_SUBMITTED if data.payment_method == "UPI" else Actions.USER_BOOKING_REQUESTED
    await log_activity(
        db, action=action_type,
        detail=f"User booked {data.num_travelers} seat(s) on package #{data.package_id} ({data.payment_method or 'Pending Approval'}) — Status: {status_val}",
        actor_type="user", user_id=current_user.id,
        metadata={
            "booking_id": booking.id, "package_id": data.package_id,
            "num_travelers": data.num_travelers, "total_amount": booking.total_amount,
            "traveler_name": data.traveler_name, "traveler_email": data.traveler_email,
            "traveler_mobile": data.traveler_mobile, "payment_method": data.payment_method,
            "upi_txn": data.upi_transaction_id,
        },
    )
    await db.commit()
    logger.info(f"Booking #{booking.id} created — {status_val}")
    return _booking_to_dict(booking)


@router.post("/bookings/{booking_id}/submit-payment")
async def submit_booking_payment(
    booking_id: int,
    data: BookingPaymentSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    User: submit payment method for an APPROVED booking.
    Transitions status to PENDING_PAYMENT (CASH) or PAYMENT_VERIFICATION (UPI).
    """
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized for this booking")
    if booking.status != "APPROVED":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot submit payment for booking in '{booking.status}' status. Must be APPROVED by admin first."
        )

    if data.payment_method not in ("CASH", "UPI"):
        raise HTTPException(status_code=400, detail="payment_method must be CASH or UPI")

    now = datetime.utcnow()
    if data.payment_method == "CASH":
        booking.status = "PENDING_PAYMENT"
        booking.payment_deadline = now + timedelta(hours=PAYMENT_DEADLINE_HOURS)
        booking.payment_method = "CASH"
        booking.upi_transaction_id = None
    else:  # UPI
        if not data.upi_transaction_id:
            raise HTTPException(status_code=400, detail="upi_transaction_id is required for UPI payment")
        booking.status = "PAYMENT_VERIFICATION"
        booking.payment_deadline = None
        booking.payment_method = "UPI"
        booking.upi_transaction_id = data.upi_transaction_id

    booking.updated_at = now

    await log_activity(
        db, action=Actions.PAYMENT_METHOD_SELECTED,
        detail=f"User selected {data.payment_method} for approved booking #{booking.id}",
        actor_type="user", user_id=current_user.id,
        metadata={"booking_id": booking.id, "payment_method": data.payment_method, "upi_txn": data.upi_transaction_id},
    )
    await db.commit()
    return _booking_to_dict(booking)


@router.get("/bookings/my")
async def get_my_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """User: list own bookings, newest first."""
    result = await db.execute(
        select(Booking)
        .where(Booking.user_id == current_user.id)
        .order_by(Booking.created_at.desc())
    )
    bookings = result.scalars().all()
    return [_booking_to_dict(b) for b in bookings]


@router.get("/bookings/{booking_id}")
async def get_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """User: get a single booking (must be own, or admin)."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view this booking")
    return _booking_to_dict(booking)


# ── Admin Booking Routes ────────────────────────────────────────

@router.get("/admin/bookings")
async def admin_list_bookings(
    status: Optional[str] = Query(None),
    package_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """Admin: list all bookings with optional filters."""
    stmt = select(Booking).order_by(Booking.created_at.desc())
    if status:
        stmt = stmt.where(Booking.status == status)
    if package_id:
        stmt = stmt.where(Booking.package_id == package_id)
    result = await db.execute(stmt)
    bookings = result.scalars().all()
    return [_booking_to_dict(b) for b in bookings]


@router.post("/admin/bookings/{booking_id}/approve")
async def approve_booking_request(
    booking_id: int,
    data: AdminApprovalAction,
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """
    Admin: approve a PENDING_ADMIN_APPROVAL booking request.
    Deducts/holds the required seats from the travel package.
    Status becomes APPROVED.
    """
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "PENDING_ADMIN_APPROVAL":
        raise HTTPException(
            status_code=400,
            detail=f"Can only approve bookings in 'PENDING_ADMIN_APPROVAL' status. Current: '{booking.status}'"
        )

    # Check seat availability at approval time
    pkg_result = await db.execute(select(TravelPackage).where(TravelPackage.id == booking.package_id))
    pkg = pkg_result.scalars().first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    if pkg.available_seats < booking.num_travelers:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve: Only {pkg.available_seats} seat(s) available on this package."
        )

    now = datetime.utcnow()
    # Reserve seats now that admin has approved
    pkg.available_seats -= booking.num_travelers
    pkg.updated_at = now

    booking.status = "APPROVED"
    booking.admin_note = data.note
    booking.updated_at = now

    await log_activity(
        db, action=Actions.ADMIN_APPROVED_BOOKING,
        detail=f"Admin APPROVED booking request #{booking_id} for {booking.traveler_name} ({booking.num_travelers} seats held)",
        actor_type="admin",
        metadata={"booking_id": booking_id, "package_id": booking.package_id, "num_travelers": booking.num_travelers, "note": data.note},
    )
    await db.commit()
    return {"message": "Booking request APPROVED. User can now proceed with payment.", "booking": _booking_to_dict(booking)}


@router.post("/admin/bookings/{booking_id}/reject")
async def reject_booking_request(
    booking_id: int,
    data: AdminApprovalAction,
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """
    Admin: reject a PENDING_ADMIN_APPROVAL booking request.
    Status becomes REJECTED. No seats are held/affected.
    """
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "PENDING_ADMIN_APPROVAL":
        raise HTTPException(
            status_code=400,
            detail=f"Can only reject bookings in 'PENDING_ADMIN_APPROVAL' status. Current: '{booking.status}'"
        )

    now = datetime.utcnow()
    booking.status = "REJECTED"
    booking.admin_note = data.note or "Booking request rejected by admin"
    booking.updated_at = now

    await log_activity(
        db, action=Actions.ADMIN_REJECTED_BOOKING,
        detail=f"Admin REJECTED booking request #{booking_id} for {booking.traveler_name}",
        actor_type="admin",
        metadata={"booking_id": booking_id, "note": data.note},
    )
    await db.commit()
    return {"message": "Booking request REJECTED.", "booking": _booking_to_dict(booking)}


@router.post("/admin/bookings/{booking_id}/confirm-payment")
async def confirm_payment(
    booking_id: int,
    data: AdminPaymentAction,
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """Admin: confirm cash or UPI payment → CONFIRMED."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status not in ("PENDING_PAYMENT", "PAYMENT_VERIFICATION"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot confirm booking with status '{booking.status}'"
        )
    now = datetime.utcnow()
    booking.status = "CONFIRMED"
    booking.admin_note = data.note
    booking.payment_deadline = None
    booking.updated_at = now
    await log_activity(
        db, action=Actions.ADMIN_CONFIRMED_PAYMENT,
        detail=f"Admin confirmed payment for booking #{booking_id} (₹{booking.total_amount})",
        actor_type="admin",
        metadata={"booking_id": booking_id, "payment_method": booking.payment_method,
                  "total_amount": booking.total_amount, "note": data.note},
    )
    await db.commit()
    return {"message": "Payment confirmed. Booking is now CONFIRMED."}


@router.post("/admin/bookings/{booking_id}/reject-payment")
async def reject_payment(
    booking_id: int,
    data: AdminPaymentAction,
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """Admin: reject UPI payment verification → CANCELLED + release seats."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "PAYMENT_VERIFICATION":
        raise HTTPException(
            status_code=400,
            detail=f"Can only reject PAYMENT_VERIFICATION bookings. Current status: '{booking.status}'"
        )
    now = datetime.utcnow()
    await _release_seats(db, booking, now)
    booking.status = "CANCELLED"
    booking.admin_note = data.note
    booking.updated_at = now
    await log_activity(
        db, action=Actions.ADMIN_REJECTED_PAYMENT,
        detail=f"Admin rejected UPI payment for booking #{booking_id}",
        actor_type="admin",
        metadata={"booking_id": booking_id, "note": data.note, "upi_txn": booking.upi_transaction_id},
    )
    await db.commit()
    return {"message": "Payment rejected. Booking CANCELLED and seats released."}


@router.post("/admin/bookings/{booking_id}/cancel")
async def cancel_booking(
    booking_id: int,
    data: AdminPaymentAction,
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """Admin: cancel any booking. Releases seats if booking was pending/verifying."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status == "CANCELLED":
        raise HTTPException(status_code=400, detail="Booking is already CANCELLED")

    now = datetime.utcnow()
    # Only release seats if they haven't been "used" yet (CONFIRMED already used seats)
    if booking.status in ("PENDING_PAYMENT", "PAYMENT_VERIFICATION"):
        await _release_seats(db, booking, now)

    booking.status = "CANCELLED"
    booking.admin_note = data.note
    booking.updated_at = now
    await log_activity(
        db, action=Actions.ADMIN_CANCELLED_BOOKING,
        detail=f"Admin cancelled booking #{booking_id}",
        actor_type="admin",
        metadata={"booking_id": booking_id, "note": data.note},
    )
    await db.commit()
    return {"message": "Booking CANCELLED successfully."}


@router.post("/admin/bookings/{booking_id}/reset")
async def reset_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """Admin: reset an EXPIRED or CANCELLED booking — gives user a new 5-hour payment window."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status not in ("CANCELLED", "EXPIRED"):
        raise HTTPException(
            status_code=400,
            detail=f"Can only reset CANCELLED or EXPIRED bookings. Current status: '{booking.status}'"
        )

    # Re-check seat availability
    pkg_result = await db.execute(
        select(TravelPackage).where(TravelPackage.id == booking.package_id)
    )
    pkg = pkg_result.scalars().first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    if pkg.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Package is no longer active")
    if pkg.available_seats < booking.num_travelers:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough seats to reset. Available: {pkg.available_seats}"
        )

    now = datetime.utcnow()
    # Re-hold seats
    pkg.available_seats -= booking.num_travelers
    pkg.updated_at = now

    booking.status = "PENDING_PAYMENT"
    booking.payment_deadline = now + timedelta(hours=PAYMENT_DEADLINE_HOURS)
    booking.admin_note = None
    booking.updated_at = now
    await log_activity(
        db, action=Actions.ADMIN_RESET_BOOKING,
        detail=f"Admin reset booking #{booking_id} — new 5-hour payment window",
        actor_type="admin",
        metadata={"booking_id": booking_id, "new_deadline": str(booking.payment_deadline)},
    )
    await db.commit()
    return {"message": "Booking reset. New 5-hour payment window started.", "deadline": booking.payment_deadline}
