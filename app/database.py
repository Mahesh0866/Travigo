from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, Date
from datetime import datetime
from app.config import settings
import logging

logger = logging.getLogger("travigo_db")
logging.basicConfig(level=logging.INFO)

engine = create_async_engine(settings.postgres_uri, echo=False)
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

# --- ORM Models ---

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    mobile = Column(String, nullable=True)
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Destination(Base):
    __tablename__ = "destinations"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    category = Column(String, index=True, nullable=False)
    location = Column(String, nullable=False)
    image_url = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

class Favorite(Base):
    __tablename__ = "favorites"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    destination_id = Column(Integer, ForeignKey("destinations.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class ContactInquiry(Base):
    __tablename__ = "contacts"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

# --- Travel Package ---

class TravelPackage(Base):
    __tablename__ = "travel_packages"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    origin = Column(String, default="Rajkot", nullable=False)
    destination = Column(String, nullable=False)
    travel_date = Column(Date, nullable=False)
    return_date = Column(Date, nullable=False)
    price = Column(Float, nullable=False)
    pickup_location = Column(String, nullable=False)
    total_seats = Column(Integer, nullable=False)
    available_seats = Column(Integer, nullable=False)
    included_services = Column(Text, nullable=True)  # JSON array stored as string
    image_url = Column(String, nullable=True)
    status = Column(String, default="ACTIVE", nullable=False)  # ACTIVE | INACTIVE | CANCELLED
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

# --- Booking ---

class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("travel_packages.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    traveler_name = Column(String, nullable=False)
    traveler_mobile = Column(String, nullable=False)
    traveler_email = Column(String, nullable=False)
    num_travelers = Column(Integer, nullable=False, default=1)
    travel_date = Column(Date, nullable=False)
    payment_method = Column(String, nullable=True)  # CASH | UPI
    upi_transaction_id = Column(String, nullable=True)
    # PENDING_PAYMENT | PAYMENT_VERIFICATION | CONFIRMED | CANCELLED | EXPIRED
    status = Column(String, default="PENDING_PAYMENT", nullable=False)
    payment_deadline = Column(DateTime, nullable=True)  # UTC; only for CASH
    admin_note = Column(String, nullable=True)
    total_amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

# --- App Settings (singleton row id=1) ---

class AppSettings(Base):
    __tablename__ = "app_settings"
    id = Column(Integer, primary_key=True, index=True)
    upi_id = Column(String, nullable=True, default="")
    upi_qr_url = Column(String, nullable=True, default="")
    updated_at = Column(DateTime, default=datetime.utcnow)

# --- Admin Config (singleton row id=1) ---

class AdminConfig(Base):
    """Stores the bcrypt-hashed 6-digit admin panel access code.
    The plaintext code is NEVER stored or returned by any API."""
    __tablename__ = "admin_config"
    id = Column(Integer, primary_key=True, index=True)
    hashed_code = Column(String, nullable=False)  # bcrypt hash of 6-digit code
    updated_at = Column(DateTime, default=datetime.utcnow)

# --- Activity / Audit Log ---

class ActivityLog(Base):
    """Audit trail of all user and admin actions."""
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # null = admin/system
    actor_type = Column(String, nullable=False)   # "user" | "admin" | "system"
    action = Column(String, nullable=False, index=True)  # e.g. "USER_SEARCH"
    detail = Column(Text, nullable=True)           # human-readable description
    metadata_json = Column(Text, nullable=True)    # JSON blob for extra structured data
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

# --- Dependency ---
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# --- Seeding ---
async def seed_database(session: AsyncSession):
    from sqlalchemy.future import select
    from passlib.context import CryptContext
    result = await session.execute(select(Destination))
    destinations = result.scalars().all()
    if not destinations:
        logger.info("Seeding destinations database with default travel locations...")
        default_destinations = [
            Destination(title="Lavender Valley", category="Nature", location="Provence, Regional Park", image_url="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80", description="Stunning fields of purple lavender stretching as far as the eye can see.", latitude=43.8333, longitude=5.3000),
            Destination(title="Royal Bastion", category="Historical", location="Old Town District", image_url="https://images.unsplash.com/photo-1508849789987-4e5333c12b78?auto=format&fit=crop&w=800&q=80", description="A grand, majestic medieval fortress overlooking the historic old town.", latitude=48.8584, longitude=2.2945)
        ]
        session.add_all(default_destinations)
        await session.commit()
        logger.info("Seeded destinations successfully.")
    else:
        logger.info("Database already contains destinations. Skipping seeding.")

    # Ensure app_settings singleton exists
    settings_result = await session.execute(select(AppSettings).where(AppSettings.id == 1))
    app_settings = settings_result.scalars().first()
    if not app_settings:
        session.add(AppSettings(id=1, upi_id="", upi_qr_url="", updated_at=datetime.utcnow()))
        await session.commit()
        logger.info("Created default app_settings row.")

    # Seed admin config: hash and store the ADMIN_CODE from .env
    # The plaintext code is read ONCE here at startup and then discarded
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    admin_cfg_result = await session.execute(select(AdminConfig).where(AdminConfig.id == 1))
    admin_cfg = admin_cfg_result.scalars().first()
    if not admin_cfg:
        hashed = pwd_context.hash(settings.admin_code)
        session.add(AdminConfig(id=1, hashed_code=hashed, updated_at=datetime.utcnow()))
        await session.commit()
        logger.info("Admin config seeded with hashed code from ADMIN_CODE env var.")
    else:
        logger.info("Admin config already exists. Skipping admin code seed.")

