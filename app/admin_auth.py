"""
admin_auth.py — Separate authentication system for the Admin Panel.

The admin panel uses a 6-digit code (stored hashed in DB) that is COMPLETELY
separate from regular user authentication. This means:
  - Normal users can never access the admin panel even if is_admin=True
  - The admin code is the ONLY way in
  - Admin routes are protected by get_current_admin_jwt(), NOT get_current_admin()
  - The admin JWT contains role="admin" claim (different from user tokens)

Routes:
  POST /api/admin/auth/login        — verify 6-digit code → return admin JWT
  POST /api/admin/auth/change-code  — change the 6-digit code (requires admin JWT)
  GET  /api/admin/auth/verify       — verify admin JWT is still valid
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config import settings
from app.database import get_db, AdminConfig

logger = logging.getLogger("travigo_admin_auth")
router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_bearer_scheme = HTTPBearer(auto_error=False)

ADMIN_ROLE_CLAIM = "admin_panel"


# ── Pydantic Models ──────────────────────────────────────────────────────────

class AdminLoginRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6, description="6-digit admin panel code")

class AdminLoginResponse(BaseModel):
    admin_token: str
    token_type: str = "bearer"
    expires_in_hours: int

class ChangeCodeRequest(BaseModel):
    new_code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$",
                          description="New 6-digit numeric code")


# ── Token Utilities ──────────────────────────────────────────────────────────

def _create_admin_token() -> str:
    """Issue a short-lived JWT exclusively for admin panel access."""
    expire = datetime.utcnow() + timedelta(hours=settings.admin_token_expire_hours)
    payload = {
        "sub": "admin_panel",
        "role": ADMIN_ROLE_CLAIM,
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, settings.admin_jwt_secret, algorithm=settings.jwt_algorithm)


def _decode_admin_token(token: str) -> dict:
    """Decode and validate an admin JWT. Raises ValueError on failure."""
    try:
        payload = jwt.decode(token, settings.admin_jwt_secret,
                             algorithms=[settings.jwt_algorithm])
        if payload.get("role") != ADMIN_ROLE_CLAIM:
            raise ValueError("Not an admin token")
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Admin session expired")
    except Exception as exc:
        raise ValueError(f"Invalid admin token: {exc}")


# ── FastAPI Dependency ────────────────────────────────────────────────────────

async def get_current_admin_jwt(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """
    FastAPI dependency that protects admin routes.
    Use this INSTEAD of get_current_admin() for all admin panel endpoints.
    Returns the decoded token payload on success.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required. Please login with your admin code.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return _decode_admin_token(credentials.credentials)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/admin/auth/login", response_model=AdminLoginResponse)
async def admin_login(
    data: AdminLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Verify the 6-digit admin panel code against the hashed value in the DB.
    Returns a short-lived admin JWT on success.
    The plaintext code is NEVER logged or stored anywhere.
    """
    # Constant-time lookup — always check DB to prevent timing attacks
    result = await db.execute(select(AdminConfig).where(AdminConfig.id == 1))
    cfg = result.scalars().first()

    is_valid = cfg is not None and pwd_context.verify(data.code, cfg.hashed_code)

    if not is_valid:
        logger.warning("Admin login attempt with incorrect code.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect admin code. Please try again.",
        )

    token = _create_admin_token()
    logger.info("Admin panel login successful. Token issued.")
    return AdminLoginResponse(
        admin_token=token,
        expires_in_hours=settings.admin_token_expire_hours,
    )


@router.get("/admin/auth/verify")
async def verify_admin_token(
    payload: dict = Depends(get_current_admin_jwt),
):
    """Lightweight endpoint to check if the admin token is still valid."""
    return {"valid": True, "role": payload.get("role")}


@router.post("/admin/auth/change-code")
async def change_admin_code(
    data: ChangeCodeRequest,
    db: AsyncSession = Depends(get_db),
    _payload: dict = Depends(get_current_admin_jwt),
):
    """
    Change the 6-digit admin code. Requires a valid admin JWT.
    The new code must be exactly 6 numeric digits.
    """
    result = await db.execute(select(AdminConfig).where(AdminConfig.id == 1))
    cfg = result.scalars().first()

    new_hashed = pwd_context.hash(data.new_code)
    now = datetime.utcnow()

    if not cfg:
        cfg = AdminConfig(id=1, hashed_code=new_hashed, updated_at=now)
        db.add(cfg)
    else:
        cfg.hashed_code = new_hashed
        cfg.updated_at = now

    await db.commit()
    logger.info("Admin code changed successfully.")
    return {"message": "Admin code changed successfully. Please login again with the new code."}
