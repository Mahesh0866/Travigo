import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load env variables from root directory
load_dotenv()

class Settings(BaseSettings):
    postgres_uri: str = os.getenv("POSTGRES_URI", "postgresql+asyncpg://postgres:postgres@localhost:5432/travigo")
    database_name: str = os.getenv("DATABASE_NAME", "travigo")
    geoapify_api_key: str = os.getenv("Geoapify", "")
    pexels_api_key: str = os.getenv("PEXELS_API_KEY", "")
    
    # Security Configuration
    jwt_secret: str = os.getenv("JWT_SECRET", "travigo_super_secret_key_for_ai_travel_recs_2026")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # 24 hours
    
    # Admin Configuration
    admin_email: str = os.getenv("ADMIN_EMAIL", "")

    # Admin Panel 6-digit Code Authentication
    # The plain code is only read at startup to seed/update the DB — never returned by any API
    admin_code: str = os.getenv("ADMIN_CODE", "123456")
    admin_jwt_secret: str = os.getenv("ADMIN_JWT_SECRET", "travigo_admin_panel_secret_jwt_2026")
    admin_token_expire_hours: int = int(os.getenv("ADMIN_TOKEN_EXPIRE_HOURS", "8"))

settings = Settings()
