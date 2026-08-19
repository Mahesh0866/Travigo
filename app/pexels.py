import os
import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
import asyncio

router = APIRouter()

# ──────────────────────────────────────────────
# In-memory cache: { place_name_lower: [photo, ...] }
# ──────────────────────────────────────────────
_pexels_cache: dict = {}

PEXELS_API_BASE = "https://api.pexels.com/v1"


class PexelsPhoto(BaseModel):
    id: int
    photographer: str
    photographer_url: str
    # Different size variants
    original: str
    large: str
    medium: str
    small: str
    tiny: str
    avg_color: Optional[str] = None
    alt: Optional[str] = None


class PlaceImagesResponse(BaseModel):
    place: str
    total_results: int
    photos: List[PexelsPhoto]


def _get_api_key() -> str:
    """Read the Pexels API key from environment at call time."""
    key = os.getenv("PEXELS_API_KEY", "").strip()
    if not key:
        raise HTTPException(
            status_code=500,
            detail="PEXELS_API_KEY is not configured in .env"
        )
    return key


def _parse_photos(raw_photos: list) -> List[PexelsPhoto]:
    """Convert raw Pexels API photo dicts into PexelsPhoto models."""
    parsed = []
    for p in raw_photos:
        src = p.get("src", {})
        parsed.append(
            PexelsPhoto(
                id=p["id"],
                photographer=p.get("photographer", ""),
                photographer_url=p.get("photographer_url", ""),
                original=src.get("original", ""),
                large=src.get("large", ""),
                medium=src.get("medium", ""),
                small=src.get("small", ""),
                tiny=src.get("tiny", ""),
                avg_color=p.get("avg_color"),
                alt=p.get("alt"),
            )
        )
    return parsed


async def fetch_place_images(
    place_name: str,
    per_page: int = 20,
    client: Optional[httpx.AsyncClient] = None,
) -> List[PexelsPhoto]:
    """
    Core async helper – fetches images for *place_name* from Pexels.
    Results are cached per (place_name, per_page) pair so different
    page sizes never collide in the cache.
    Pass an existing httpx.AsyncClient to reuse it.
    """
    # Cache key includes per_page so count=20 and count=9 don't share an entry
    cache_key = f"{place_name.strip().lower()}::{per_page}"
    if cache_key in _pexels_cache:
        return _pexels_cache[cache_key]

    api_key = _get_api_key()
    headers = {"Authorization": api_key}

    # Build a travel-focused search query
    search_query = f"{place_name} travel tourism"

    should_close = client is None
    if client is None:
        client = httpx.AsyncClient(timeout=10.0)

    try:
        response = await client.get(
            f"{PEXELS_API_BASE}/search",
            headers=headers,
            params={
                "query": search_query,
                "per_page": per_page,
                "orientation": "landscape",
            },
        )
        response.raise_for_status()
        data = response.json()
        photos = _parse_photos(data.get("photos", []))

        # If landscape search returned nothing, retry without orientation
        if not photos:
            response2 = await client.get(
                f"{PEXELS_API_BASE}/search",
                headers=headers,
                params={"query": place_name, "per_page": per_page},
            )
            response2.raise_for_status()
            data2 = response2.json()
            photos = _parse_photos(data2.get("photos", []))

        _pexels_cache[cache_key] = photos
        return photos

    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Pexels API error: {exc.response.text}",
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Could not reach Pexels API: {exc}",
        )
    finally:
        if should_close:
            await client.aclose()


# ──────────────────────────────────────────────
# FastAPI endpoint:  GET /api/images/{place}
# ──────────────────────────────────────────────

@router.get("/images/{place}", response_model=PlaceImagesResponse)
async def get_place_images(
    place: str,
    count: int = Query(
        default=20,
        ge=1,
        le=80,   # Pexels API maximum is 80 per request
        description="Number of images to fetch (1–80, default 20)",
    ),
):
    """
    Fetches travel photos for a destination from Pexels.

    - **place**: destination name, e.g. `Matheran`, `Goa`, `Jaipur`
    - **count**: how many images to return (1-30, default 9)

    Images are fetched live from the Pexels API and cached in memory
    for the lifetime of the server process.  The actual image files
    are hosted entirely on Pexels CDN – we only return their URLs.
    """
    photos = await fetch_place_images(place_name=place, per_page=count)
    return PlaceImagesResponse(
        place=place,
        total_results=len(photos),
        photos=photos,
    )
