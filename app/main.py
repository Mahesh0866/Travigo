from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio

from app.database import engine, Base, seed_database, AsyncSessionLocal
from app.routes import router as api_router
from app.search import router as search_router
from app.places import router as places_router
from app.pexels import router as pexels_router
from app.packages import router as packages_router
from app.bookings import router as bookings_router
from app.admin_auth import router as admin_auth_router
from app.activity import router as activity_router
from app.scheduler import expire_pending_bookings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables (new tables will be created; existing tables unchanged)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # Seed database
    async with AsyncSessionLocal() as session:
        await seed_database(session)
    
    # Start background scheduler for auto-expiring bookings
    scheduler_task = asyncio.create_task(expire_pending_bookings())
        
    yield
    
    # Shutdown: cancel scheduler and dispose connection pool
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass
    await engine.dispose()

import os
from fastapi.staticfiles import StaticFiles

# Ensure uploads directory exists for storing admin QR scanner images
import tempfile
UPLOAD_DIR = tempfile.gettempdir() + "/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="Travigo Backend API",
    description="FastAPI + PostgreSQL backend for Travigo tourist recommendation & travel packages.",
    version="2.0.0",
    lifespan=lifespan
)

# Serve uploaded static files (e.g. UPI QR Scanner images)
app.mount("/static/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
# CORS configurations
# Allowing React Vite dev server origin for API connection
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL,"https://travigo-nu.vercel.app", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(api_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(places_router, prefix="/api")
app.include_router(pexels_router, prefix="/api")
app.include_router(packages_router, prefix="/api")
app.include_router(bookings_router, prefix="/api")
app.include_router(admin_auth_router, prefix="/api")  # 6-digit admin login
app.include_router(activity_router, prefix="/api")    # activity log + enhanced stats

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to the Travigo AI Travel Recommendation API v2. Visit /docs for documentation."
    }
