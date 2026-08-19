from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.models import (
    UserRegister, UserLogin, UserResponse, UserProfile, UserProfileUpdate, Token,
    DestinationCreate, DestinationResponse,
    ContactInquiryCreate, ContactInquiryResponse,
    RecommendationResponse
)
from app.database import get_db, User, Destination, Favorite, ContactInquiry
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user
from app.recommendation import get_hybrid_recommendations
from app.config import settings
from typing import List, Optional
from datetime import datetime
import httpx
import asyncio
from app.places import fetch_pexels_candidates, FALLBACK_IMAGES
from app.activity import log_activity, Actions

router = APIRouter()

POPULAR_PLACES_DATA = [
    {
        "id": 101,
        "name": "Taj Mahal",
        "address": "Agra, Uttar Pradesh, India",
        "category": "tourism.sights",
        "hidden_gem_score": 98.5,
        "description": "Iconic white marble mausoleum and universal symbol of eternal love.",
        "coordinates": {"latitude": 27.1751, "longitude": 78.0421}
    },
    {
        "id": 102,
        "name": "Matheran Hill Station",
        "address": "Matheran, Maharashtra, India",
        "category": "natural",
        "hidden_gem_score": 96.0,
        "description": "Automobile-free tranquil hill station surrounded by red-earth trails and lush forests.",
        "coordinates": {"latitude": 18.9886, "longitude": 73.2680}
    },
    {
        "id": 103,
        "name": "Udaipur Lake Palace",
        "address": "Udaipur, Rajasthan, India",
        "category": "tourism.sights",
        "hidden_gem_score": 95.2,
        "description": "Floating white marble palace on Lake Pichola with majestic Aravalli views.",
        "coordinates": {"latitude": 24.5754, "longitude": 73.6800}
    },
    {
        "id": 104,
        "name": "Solang Valley",
        "address": "Manali, Himachal Pradesh, India",
        "category": "sport",
        "hidden_gem_score": 93.8,
        "description": "Snow-covered adventure valley known for paragliding, skiing, and mountain panoramas.",
        "coordinates": {"latitude": 32.2432, "longitude": 77.1892}
    },
    {
        "id": 105,
        "name": "Jaipur Hawa Mahal",
        "address": "Jaipur, Rajasthan, India",
        "category": "historical",
        "hidden_gem_score": 92.4,
        "description": "The landmark Palace of Winds with 953 intricate honeycomb pink sandstone windows.",
        "coordinates": {"latitude": 26.9239, "longitude": 75.8267}
    },
    {
        "id": 106,
        "name": "Palolem Beach",
        "address": "Canacona, Goa, India",
        "category": "natural",
        "hidden_gem_score": 90.7,
        "description": "Picture-perfect crescent bay lined with palm trees and vibrant beach shacks.",
        "coordinates": {"latitude": 15.0100, "longitude": 74.0233}
    }
]

_popular_places_cache = None


# --- AUTHENTICATION ROUTES ---

@router.post("/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: AsyncSession = Depends(get_db)):
    if not user_data.full_name or not user_data.email or not user_data.mobile or not user_data.password or not user_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All fields are required."
        )
    if user_data.password != user_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match."
        )
    import re
    if not re.match(r'^\+?[0-9]{10,15}$', user_data.mobile):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid mobile number. Must be 10 to 15 digits."
        )

    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    hashed_password = get_password_hash(user_data.password)
    # Auto-grant admin if email matches ADMIN_EMAIL in .env
    is_admin = bool(settings.admin_email and user_data.email.lower() == settings.admin_email.lower())
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        mobile=user_data.mobile,
        is_admin=is_admin,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    await log_activity(
        db, action=Actions.USER_REGISTERED,
        detail=f"New user registered: {new_user.full_name} ({new_user.email})",
        actor_type="user", user_id=new_user.id,
        metadata={"email": new_user.email, "full_name": new_user.full_name, "mobile": new_user.mobile},
    )
    await db.commit()
    return new_user

@router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    user = result.scalars().first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Sync is_admin from env (handles the case where ADMIN_EMAIL was set after registration)
    if settings.admin_email and user.email.lower() == settings.admin_email.lower() and not user.is_admin:
        user.is_admin = True
        await db.commit()
        await db.refresh(user)
    access_token = create_access_token(data={"sub": user.email})
    await log_activity(
        db, action=Actions.USER_LOGIN,
        detail=f"User logged in: {user.full_name or user.email}",
        actor_type="user", user_id=user.id,
        metadata={"email": user.email},
    )
    await db.commit()
    return {"access_token": access_token, "token_type": "bearer", "is_admin": user.is_admin}

@router.post("/auth/swagger-login", response_model=Token, include_in_schema=False)
async def swagger_login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/auth/me", response_model=UserProfile)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/auth/me", response_model=UserProfile)
async def update_me(
    update_data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the currently logged-in user's full_name and/or mobile."""
    import re

    if update_data.full_name is not None:
        stripped = update_data.full_name.strip()
        if len(stripped) < 2:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Full name must be at least 2 characters.")
        current_user.full_name = stripped

    if update_data.mobile is not None:
        mobile = update_data.mobile.strip()
        if not re.match(r'^\+?[0-9]{10,15}$', mobile):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Invalid mobile number. Must be 10–15 digits.")
        current_user.mobile = mobile

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user



@router.get("/destinations", response_model=List[DestinationResponse])
async def get_destinations(
    q: Optional[str] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Destination)
    
    if q:
        from sqlalchemy import or_
        stmt = stmt.where(or_(
            Destination.title.ilike(f"%{q}%"),
            Destination.description.ilike(f"%{q}%"),
            Destination.location.ilike(f"%{q}%")
        ))
        
    if category and category.lower() != "all places":
        stmt = stmt.where(Destination.category.ilike(category))
            
    result = await db.execute(stmt)
    destinations = result.scalars().all()
    return destinations

@router.get("/destinations/{id}", response_model=DestinationResponse)
async def get_destination(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Destination).where(Destination.id == id))
    dest = result.scalars().first()
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")
    return dest

@router.post("/destinations", response_model=DestinationResponse, status_code=status.HTTP_201_CREATED)
async def create_destination(dest_data: DestinationCreate, db: AsyncSession = Depends(get_db)):
    new_dest = Destination(
        title=dest_data.title,
        category=dest_data.category,
        location=dest_data.location,
        image_url=dest_data.image_url,
        description=dest_data.description,
        latitude=dest_data.coordinates.latitude,
        longitude=dest_data.coordinates.longitude
    )
    db.add(new_dest)
    await db.commit()
    await db.refresh(new_dest)
    return new_dest


# --- FAVORITES ROUTES (SECURED) ---

@router.get("/favorites", response_model=List[DestinationResponse])
async def get_favorites(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Favorite).where(Favorite.user_id == current_user.id))
    favs = result.scalars().all()
    
    liked_destinations = []
    for f in favs:
        dest_res = await db.execute(select(Destination).where(Destination.id == f.destination_id))
        dest = dest_res.scalars().first()
        if dest:
            liked_destinations.append(dest)
                
    return liked_destinations

@router.post("/favorites/{destination_id}", status_code=status.HTTP_201_CREATED)
async def add_favorite(destination_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    dest_res = await db.execute(select(Destination).where(Destination.id == destination_id))
    dest = dest_res.scalars().first()
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")
        
    fav_res = await db.execute(select(Favorite).where(
        Favorite.user_id == current_user.id,
        Favorite.destination_id == destination_id
    ))
    existing_fav = fav_res.scalars().first()
    
    if existing_fav:
        return {"status": "already favorited", "id": existing_fav.id}
        
    new_fav = Favorite(user_id=current_user.id, destination_id=destination_id)
    db.add(new_fav)
    await db.commit()
    await db.refresh(new_fav)
    return {"status": "success", "id": new_fav.id}

@router.delete("/favorites/{destination_id}")
async def remove_favorite(destination_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    fav_res = await db.execute(select(Favorite).where(
        Favorite.user_id == current_user.id,
        Favorite.destination_id == destination_id
    ))
    existing_fav = fav_res.scalars().first()
    
    if not existing_fav:
        raise HTTPException(status_code=404, detail="Favorite not found")
        
    await db.delete(existing_fav)
    await db.commit()
    return {"status": "success", "message": "Favorite removed"}


# --- CONTACT INQUIRY ROUTE ---

@router.post("/contact", response_model=ContactInquiryResponse, status_code=status.HTTP_201_CREATED)
async def create_contact_inquiry(inquiry_data: ContactInquiryCreate, db: AsyncSession = Depends(get_db)):
    new_inquiry = ContactInquiry(**inquiry_data.dict())
    db.add(new_inquiry)
    await db.commit()
    await db.refresh(new_inquiry)
    return new_inquiry


# --- CONFIGURATION ROUTE ---

@router.get("/config/map")
async def get_map_config():
    return {
        "apiKey": settings.geoapify_api_key
    }


# --- AI RECOMMENDATIONS ROUTE ---

@router.get("/recommendations", response_model=List[RecommendationResponse])
async def get_recommendations(
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    q: Optional[str] = None,
    category: Optional[str] = None,
    token: Optional[str] = None, # Optional auth token passed in query parameters
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Destination))
    destinations_orm = result.scalars().all()
    
    user_liked_categories = []
    
    if token:
        try:
            import jwt as pyjwt
            payload = pyjwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
            email = payload.get("sub")
            if email:
                user_res = await db.execute(select(User).where(User.email == email))
                user = user_res.scalars().first()
                if user:
                    favs_res = await db.execute(select(Favorite).where(Favorite.user_id == user.id))
                    favs = favs_res.scalars().all()
                    
                    for f in favs:
                        dest_res = await db.execute(select(Destination).where(Destination.id == f.destination_id))
                        dest = dest_res.scalars().first()
                        if dest and dest.category:
                            user_liked_categories.append(dest.category)
        except Exception:
            pass

    # Recommendation engine expects list of dicts
    destinations = []
    for d in destinations_orm:
        destinations.append({
            "id": d.id,
            "title": d.title,
            "category": d.category,
            "location": d.location,
            "image_url": d.image_url,
            "description": d.description,
            "coordinates": {"latitude": d.latitude, "longitude": d.longitude}
        })

    recommendations = get_hybrid_recommendations(
        destinations=destinations,
        user_lat=lat,
        user_lon=lon,
        search_query=q,
        category_filter=category,
        user_liked_categories=user_liked_categories if user_liked_categories else None
    )
    
    return recommendations


# --- POPULAR PLACES ROUTE ---

@router.get("/popular-places")
async def get_popular_places(db: AsyncSession = Depends(get_db)):
    """
    Returns a curated list of top-rated popular places enriched with unique Pexels images.
    Results are cached in memory after first fetch for instant response.
    Ordered by hidden_gem_score DESC.
    """
    global _popular_places_cache
    if _popular_places_cache:
        return _popular_places_cache

    combined_list = list(POPULAR_PLACES_DATA)

    # Incorporate custom database destinations if available
    try:
        db_results = await db.execute(select(Destination))
        db_dests = db_results.scalars().all()
        for db_d in db_dests:
            combined_list.append({
                "id": db_d.id,
                "name": db_d.title,
                "address": db_d.location,
                "category": db_d.category,
                "hidden_gem_score": 94.0,
                "description": db_d.description,
                "image_url": db_d.image_url,
                "image_source": "database",
                "coordinates": {"latitude": db_d.latitude, "longitude": db_d.longitude}
            })
    except Exception:
        pass

    # Sort by gem score descending
    combined_list.sort(key=lambda x: x.get("hidden_gem_score", 0), reverse=True)
    top_popular = combined_list[:8]

    # Enrich with Pexels images concurrently
    async with httpx.AsyncClient(timeout=10.0) as client:
        tasks = [fetch_pexels_candidates(client, p["name"], 10) for p in top_popular]
        all_pexels_results = await asyncio.gather(*tasks)

    used_urls = set()
    enriched_results = []
    
    for item, pexels_candidates in zip(top_popular, all_pexels_results):
        item_copy = dict(item)
        if item_copy.get("image_source") == "database" and item_copy.get("image_url"):
            used_urls.add(item_copy["image_url"])
            enriched_results.append(item_copy)
            continue
            
        chosen_url = None
        for url in pexels_candidates:
            if url not in used_urls:
                chosen_url = url
                used_urls.add(url)
                break
                
        item_copy["image_url"] = chosen_url or FALLBACK_IMAGES.get(item_copy.get("category", ""), FALLBACK_IMAGES["default"])
        item_copy["image_source"] = "pexels" if chosen_url else "fallback"
        enriched_results.append(item_copy)

    _popular_places_cache = enriched_results
    return _popular_places_cache

