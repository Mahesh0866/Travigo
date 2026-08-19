"""
packages.py — FastAPI router for Travel Package management.

Public routes:
  GET /api/packages         — list active packages
  GET /api/packages/{id}    — get single package

Admin routes (requires admin_jwt):
  GET    /api/admin/packages                    — list all packages
  POST   /api/admin/packages                    — create package
  PUT    /api/admin/packages/{id}               — edit package
  PATCH  /api/admin/packages/{id}/status        — change status
  GET    /api/admin/packages/{id}/bookings      — all bookings for a package
  GET    /api/admin/stats                       — dashboard statistics
"""
import json
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, TravelPackage, Booking, User
from app.models import (
    TravelPackageCreate,
    TravelPackageUpdate,
    TravelPackageResponse,
    PackageStatusUpdate,
)
from app.admin_auth import get_current_admin_jwt
from app.activity import log_activity, Actions

logger = logging.getLogger("travigo_packages")
router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────

def _pkg_to_dict(pkg: TravelPackage) -> dict:
    services: List[str] = []
    if pkg.included_services:
        try:
            services = json.loads(pkg.included_services)
        except Exception:
            services = [pkg.included_services]
    return {
        "id": pkg.id,
        "name": pkg.name,
        "description": pkg.description,
        "origin": pkg.origin,
        "destination": pkg.destination,
        "travel_date": pkg.travel_date,
        "return_date": pkg.return_date,
        "price": pkg.price,
        "pickup_location": pkg.pickup_location,
        "total_seats": pkg.total_seats,
        "available_seats": pkg.available_seats,
        "included_services": services,
        "image_url": pkg.image_url,
        "status": pkg.status,
        "created_by": pkg.created_by,
        "created_at": pkg.created_at,
        "updated_at": pkg.updated_at,
    }


# ── Public Routes ───────────────────────────────────────────────

@router.get("/packages")
async def list_active_packages(db: AsyncSession = Depends(get_db)):
    """Return all ACTIVE travel packages."""
    result = await db.execute(
        select(TravelPackage).where(TravelPackage.status == "ACTIVE")
    )
    packages = result.scalars().all()
    return [_pkg_to_dict(p) for p in packages]


@router.get("/packages/{package_id}")
async def get_package(package_id: int, db: AsyncSession = Depends(get_db)):
    """Return a single package (any status) by ID."""
    result = await db.execute(select(TravelPackage).where(TravelPackage.id == package_id))
    pkg = result.scalars().first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    return _pkg_to_dict(pkg)


# ── Admin Routes ────────────────────────────────────────────────

@router.get("/admin/packages")
async def admin_list_packages(
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """Admin: list all packages (all statuses)."""
    result = await db.execute(select(TravelPackage).order_by(TravelPackage.created_at.desc()))
    packages = result.scalars().all()
    return [_pkg_to_dict(p) for p in packages]


@router.post("/admin/packages", status_code=status.HTTP_201_CREATED)
async def create_package(
    data: TravelPackageCreate,
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """Admin: create a new travel package."""
    now = datetime.utcnow()
    pkg = TravelPackage(
        name=data.name,
        description=data.description,
        origin=data.origin or "Rajkot",
        destination=data.destination,
        travel_date=data.travel_date,
        return_date=data.return_date,
        price=data.price,
        pickup_location=data.pickup_location,
        total_seats=data.total_seats,
        available_seats=data.total_seats,
        included_services=json.dumps(data.included_services),
        image_url=data.image_url,
        status="ACTIVE",
        created_by=None,
        created_at=now,
        updated_at=now,
    )
    db.add(pkg)
    await db.commit()
    await db.refresh(pkg)
    await log_activity(
        db, action=Actions.ADMIN_CREATED_PACKAGE,
        detail=f"Admin created package: {pkg.name} ({pkg.origin} → {pkg.destination})",
        actor_type="admin",
        metadata={"package_id": pkg.id, "name": pkg.name, "destination": pkg.destination,
                  "price": pkg.price, "total_seats": pkg.total_seats},
    )
    await db.commit()
    return _pkg_to_dict(pkg)


@router.put("/admin/packages/{package_id}")
async def update_package(
    package_id: int,
    data: TravelPackageUpdate,
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """Admin: edit an existing travel package."""
    result = await db.execute(select(TravelPackage).where(TravelPackage.id == package_id))
    pkg = result.scalars().first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")

    update_data = data.dict(exclude_unset=True)
    if "included_services" in update_data:
        update_data["included_services"] = json.dumps(update_data["included_services"])
    if "total_seats" in update_data:
        seat_diff = update_data["total_seats"] - pkg.total_seats
        pkg.available_seats = max(0, pkg.available_seats + seat_diff)

    for field, value in update_data.items():
        setattr(pkg, field, value)

    pkg.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(pkg)
    await log_activity(
        db, action=Actions.ADMIN_UPDATED_PACKAGE,
        detail=f"Admin updated package #{package_id}: {pkg.name}",
        actor_type="admin",
        metadata={"package_id": package_id, "fields_updated": list(update_data.keys())},
    )
    await db.commit()
    return _pkg_to_dict(pkg)


@router.patch("/admin/packages/{package_id}/status")
async def update_package_status(
    package_id: int,
    data: PackageStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """Admin: activate, deactivate, cancel, or restore a package."""
    valid = {"ACTIVE", "INACTIVE", "CANCELLED"}
    if data.status not in valid:
        raise HTTPException(
            status_code=400, detail=f"Invalid status. Must be one of: {sorted(valid)}"
        )

    result = await db.execute(select(TravelPackage).where(TravelPackage.id == package_id))
    pkg = result.scalars().first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")

    old_status = pkg.status
    pkg.status = data.status
    pkg.updated_at = datetime.utcnow()
    await log_activity(
        db, action=Actions.ADMIN_CHANGED_PKG_STATUS,
        detail=f"Admin changed package #{package_id} status: {old_status} → {data.status}",
        actor_type="admin",
        metadata={"package_id": package_id, "old_status": old_status, "new_status": data.status, "name": pkg.name},
    )
    await db.commit()
    return {"message": f"Package status updated to {data.status}", "id": package_id}


@router.get("/admin/packages/{package_id}/bookings")
async def get_package_bookings(
    package_id: int,
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """Admin: list all bookings for a specific travel package."""
    pkg_result = await db.execute(select(TravelPackage).where(TravelPackage.id == package_id))
    pkg = pkg_result.scalars().first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")

    booking_result = await db.execute(
        select(Booking).where(Booking.package_id == package_id).order_by(Booking.created_at.desc())
    )
    bookings = booking_result.scalars().all()

    return {
        "package": _pkg_to_dict(pkg),
        "bookings": [
            {
                "id": b.id,
                "user_id": b.user_id,
                "traveler_name": b.traveler_name,
                "traveler_mobile": b.traveler_mobile,
                "traveler_email": b.traveler_email,
                "num_travelers": b.num_travelers,
                "travel_date": b.travel_date,
                "payment_method": b.payment_method,
                "upi_transaction_id": b.upi_transaction_id,
                "status": b.status,
                "total_amount": b.total_amount,
                "payment_deadline": b.payment_deadline,
                "admin_note": b.admin_note,
                "created_at": b.created_at,
            }
            for b in bookings
        ],
        "summary": {
            "total": len(bookings),
            "confirmed": sum(1 for b in bookings if b.status == "CONFIRMED"),
            "pending": sum(1 for b in bookings if b.status in ("PENDING_PAYMENT", "PAYMENT_VERIFICATION")),
            "cancelled": sum(1 for b in bookings if b.status == "CANCELLED"),
            "expired": sum(1 for b in bookings if b.status == "EXPIRED"),
            "total_revenue": round(sum(b.total_amount for b in bookings if b.status == "CONFIRMED"), 2),
        },
    }


@router.get("/admin/stats")
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """Admin: dashboard aggregate statistics (legacy - use /admin/activity/stats for enhanced)."""
    pkg_result = await db.execute(select(TravelPackage))
    packages = pkg_result.scalars().all()

    booking_result = await db.execute(select(Booking))
    bookings = booking_result.scalars().all()

    total_packages = len(packages)
    active_packages = sum(1 for p in packages if p.status == "ACTIVE")
    inactive_packages = sum(1 for p in packages if p.status == "INACTIVE")
    cancelled_packages = sum(1 for p in packages if p.status == "CANCELLED")

    total_bookings = len(bookings)
    pending_payments = sum(
        1 for b in bookings if b.status in ("PENDING_PAYMENT", "PAYMENT_VERIFICATION")
    )
    confirmed_bookings = sum(1 for b in bookings if b.status == "CONFIRMED")
    expired_bookings = sum(1 for b in bookings if b.status == "EXPIRED")
    cancelled_bookings = sum(1 for b in bookings if b.status == "CANCELLED")
    available_seats = sum(p.available_seats for p in packages if p.status == "ACTIVE")

    return {
        "total_packages": total_packages,
        "active_packages": active_packages,
        "inactive_packages": inactive_packages,
        "cancelled_packages": cancelled_packages,
        "total_bookings": total_bookings,
        "pending_payments": pending_payments,
        "confirmed_bookings": confirmed_bookings,
        "expired_bookings": expired_bookings,
        "cancelled_bookings": cancelled_bookings,
        "available_seats": available_seats,
    }
