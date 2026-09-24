from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Optional
from datetime import datetime, date
import re

# --- Coordinates Model ---
class Coordinates(BaseModel):
    latitude: float
    longitude: float

# --- User Models ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    confirm_password: str = Field(..., description="Confirm password")
    full_name: str = Field(..., min_length=2, description="Full name")
    mobile: str = Field(..., min_length=10, max_length=10, description="Mobile number")

    @field_validator('mobile')
    @classmethod
    def validate_mobile(cls, v: str) -> str:
        if not v or not re.match(r'^[0-9]{10}$', v.strip()):
            raise ValueError("Mobile number must contain exactly 10 numeric digits.")
        return v.strip()

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not re.search(r'[A-Z]', v):
            raise ValueError("Password must contain at least 1 uppercase letter (A-Z).")
        if not re.search(r'[a-z]', v):
            raise ValueError("Password must contain at least 1 lowercase letter (a-z).")
        if not re.search(r'[0-9]', v):
            raise ValueError("Password must contain at least 1 number (0-9).")
        if not re.search(r'[^A-Za-z0-9]', v):
            raise ValueError("Password must contain at least 1 special character (e.g. @, #, $, %, !).")
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    mobile: Optional[str] = None
    is_admin: bool = False

    class Config:
        from_attributes = True

class UserProfile(BaseModel):
    """Full profile returned from /auth/me — includes all user fields."""
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    mobile: Optional[str] = None
    is_admin: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserProfileUpdate(BaseModel):
    """Payload for PATCH /auth/me — all fields optional."""
    full_name: Optional[str] = Field(None, min_length=2, description="Full name")
    mobile: Optional[str] = Field(None, min_length=10, max_length=10, description="Mobile number")

    @field_validator('mobile')
    @classmethod
    def validate_mobile(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_stripped = v.strip()
            if not re.match(r'^[0-9]{10}$', v_stripped):
                raise ValueError("Mobile number must contain exactly 10 numeric digits.")
            return v_stripped
        return v

# --- Token Models ---
class Token(BaseModel):
    access_token: str
    token_type: str
    is_admin: bool = False

# --- Destination Models ---
class DestinationBase(BaseModel):
    title: str
    category: str
    location: str
    image_url: str
    description: str
    coordinates: Coordinates

class DestinationCreate(DestinationBase):
    pass

class DestinationResponse(DestinationBase):
    id: int

    class Config:
        from_attributes = True



# --- Contact Inquiry Models ---
class ContactInquiryCreate(BaseModel):
    email: EmailStr
    subject: str = Field(..., min_length=3, max_length=100)
    message: str = Field(..., min_length=10, max_length=1000)

class ContactInquiryResponse(ContactInquiryCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Recommendation Models ---
class RecommendationResponse(DestinationResponse):
    ai_score: float
    distance_km: Optional[float] = None

# ─────────────────────────────────────────────────────────
# Travel Package Models
# ─────────────────────────────────────────────────────────

class TravelPackageCreate(BaseModel):
    name: str = Field(..., min_length=3)
    description: str = Field(..., min_length=10)
    origin: str = "Rajkot"
    destination: str
    travel_date: date
    return_date: date
    price: float = Field(..., gt=0)
    pickup_location: str
    total_seats: int = Field(..., gt=0)
    included_services: List[str] = []
    image_url: Optional[str] = None

class TravelPackageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    travel_date: Optional[date] = None
    return_date: Optional[date] = None
    price: Optional[float] = None
    pickup_location: Optional[str] = None
    total_seats: Optional[int] = None
    included_services: Optional[List[str]] = None
    image_url: Optional[str] = None

class PackageStatusUpdate(BaseModel):
    status: str  # ACTIVE | INACTIVE | CANCELLED

class TravelPackageResponse(BaseModel):
    id: int
    name: str
    description: str
    origin: str
    destination: str
    travel_date: date
    return_date: date
    price: float
    pickup_location: str
    total_seats: int
    available_seats: int
    included_services: List[str]
    image_url: Optional[str]
    status: str
    created_by: Optional[int]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

# ─────────────────────────────────────────────────────────
# Booking Models
# ─────────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    package_id: int
    traveler_name: str = Field(..., min_length=2)
    traveler_mobile: str = Field(..., min_length=10, max_length=10)
    traveler_email: EmailStr
    num_travelers: int = Field(..., ge=1)
    travel_date: date
    # payment_method & upi_transaction_id are optional during initial request phase (pre-approval)
    payment_method: Optional[str] = None
    upi_transaction_id: Optional[str] = None

    @field_validator('traveler_mobile')
    @classmethod
    def validate_mobile(cls, v: str) -> str:
        if not v or not re.match(r'^[0-9]{10}$', v.strip()):
            raise ValueError("Mobile number must contain exactly 10 numeric digits.")
        return v.strip()

class BookingPaymentSubmit(BaseModel):
    payment_method: str  # CASH | UPI
    upi_transaction_id: Optional[str] = None

class AdminApprovalAction(BaseModel):
    note: Optional[str] = None

class BookingResponse(BaseModel):
    id: int
    package_id: int
    user_id: int
    traveler_name: str
    traveler_mobile: str
    traveler_email: str
    num_travelers: int
    travel_date: date
    payment_method: Optional[str]
    upi_transaction_id: Optional[str]
    status: str
    payment_deadline: Optional[datetime]
    admin_note: Optional[str]
    total_amount: float
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class AdminPaymentAction(BaseModel):
    note: Optional[str] = None

# ─────────────────────────────────────────────────────────
# App Settings Models
# ─────────────────────────────────────────────────────────

class AppSettingsUpdate(BaseModel):
    upi_id: str
    qr_image_base64: Optional[str] = None

class AppSettingsResponse(BaseModel):
    id: int
    upi_id: Optional[str]
    qr_image_base64: Optional[str] = None
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
