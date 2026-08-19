import os
import time
import asyncio
import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

# Data Model
class Place(BaseModel):
    name: str
    lat: float
    lon: float
    category: str
    description: Optional[str] = None
    address: Optional[str] = None
    image_url: Optional[str] = None
    image_source: Optional[str] = None

# Caches
places_cache = {}
image_cache = {}
CACHE_TTL = 3600  # 1 hour

CATEGORY_FILTERS = {
    "tourist": 'node["tourism"="attraction"](area.a);',
    "historical": 'node["historic"](area.a);',
    "food": 'node["amenity"="restaurant"](area.a);',
    "adventure": 'node["natural"="peak"](area.a);',
    "hidden_gem": 'node["tourism"="viewpoint"](area.a);'
}

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
]

FALLBACK_IMAGES = {
    "tourist": "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80",
    "tourism.attraction": "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80",
    "historical": "https://images.unsplash.com/photo-1461301214746-1e109215d6d3?auto=format&fit=crop&w=800&q=80",
    "tourism.sights": "https://images.unsplash.com/photo-1461301214746-1e109215d6d3?auto=format&fit=crop&w=800&q=80",
    "tourism.sights.place_of_worship.temple": "https://images.unsplash.com/photo-1514222288957-49a4658e3bce?auto=format&fit=crop&w=800&q=80",
    "food": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
    "catering.restaurant": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
    "adventure": "https://images.unsplash.com/photo-1522199755839-a2bacb67c546?auto=format&fit=crop&w=800&q=80",
    "natural": "https://images.unsplash.com/photo-1505820013142-f86a3439c5b2?auto=format&fit=crop&w=800&q=80",
    "sport": "https://images.unsplash.com/photo-1522199755839-a2bacb67c546?auto=format&fit=crop&w=800&q=80",
    "hidden_gem": "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80",
    "default": "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80"
}

async def enrich_image(client: httpx.AsyncClient, place_name: str, category: str):
    """
    Attempts to find an image for the place via:
      1. Wikipedia thumbnail
      2. Pexels API (uses PEXELS_API_KEY from .env)
      3. Unsplash API (if UNSPLASH_ACCESS_KEY is set)
      4. Static category fallback image
    """
    if place_name in image_cache:
        return image_cache[place_name]

    image_url = None
    image_source = None
    description = None

    # 1. Try Wikipedia – good for descriptions and a thumbnail
    try:
        search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={place_name}&utf8=&format=json"
        search_res = await client.get(search_url, timeout=5.0)
        if search_res.status_code == 200:
            search_data = search_res.json()
            search_results = search_data.get("query", {}).get("search", [])

            if search_results:
                title = search_results[0]["title"]
                wiki_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{title}"
                wiki_res = await client.get(wiki_url, timeout=5.0)

                if wiki_res.status_code == 200:
                    data = wiki_res.json()
                    description = data.get("extract")
                    thumb = data.get("thumbnail", {})
                    # Only use the Wikipedia thumbnail if it is large enough to look good
                    if thumb and "source" in thumb:
                        w = thumb.get("width", 0)
                        h = thumb.get("height", 0)
                        if w >= 400 and h >= 250:
                            image_url = thumb["source"]
                            image_source = "wikipedia"
    except Exception:
        pass

    # 2. Pexels – reliable, free, high-quality travel photos per destination
    if not image_url:
        pexels_key = os.getenv("PEXELS_API_KEY", "").strip()
        if pexels_key:
            try:
                pexels_res = await client.get(
                    "https://api.pexels.com/v1/search",
                    headers={"Authorization": pexels_key},
                    params={
                        "query": f"{place_name} travel",
                        "per_page": 1,
                        "orientation": "landscape",
                    },
                    timeout=6.0,
                )
                if pexels_res.status_code == 200:
                    pexels_data = pexels_res.json()
                    photos = pexels_data.get("photos", [])
                    if photos:
                        # Use the "large" size – good quality, not oversized
                        src = photos[0].get("src", {})
                        pexels_url = src.get("large") or src.get("medium") or src.get("original")
                        if pexels_url:
                            image_url = pexels_url
                            image_source = "pexels"
            except Exception:
                pass

    # 3. Unsplash – fallback if Unsplash key is configured
    if not image_url:
        unsplash_key = os.getenv("UNSPLASH_ACCESS_KEY")
        if unsplash_key:
            try:
                unsplash_url = "https://api.unsplash.com/search/photos"
                params = {"query": place_name, "client_id": unsplash_key, "per_page": 1}
                un_res = await client.get(unsplash_url, params=params, timeout=5.0)
                if un_res.status_code == 200:
                    data = un_res.json()
                    results = data.get("results", [])
                    if results:
                        urls = results[0].get("urls", {})
                        if "regular" in urls:
                            image_url = urls["regular"]
                            image_source = "unsplash"
            except Exception:
                pass

    # 4. Static category fallback
    if not image_url:
        image_url = FALLBACK_IMAGES.get(category, FALLBACK_IMAGES["default"])
        image_source = "fallback"

    result = (image_url, image_source, description)
    image_cache[place_name] = result
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Focused helpers used by the batch search endpoint (search.py).
# These are intentionally separate from enrich_image so the /places endpoint
# and its single-result cache continue to work unchanged.
# ──────────────────────────────────────────────────────────────────────────────

async def fetch_wiki_summary(client: httpx.AsyncClient, place_name: str):
    """
    Fetches a Wikipedia summary and thumbnail for a destination.

    Returns (thumbnail_url | None, description_extract | None).
    The thumbnail is only returned when it is at least 400 × 250 px.
    """
    try:
        search_url = (
            f"https://en.wikipedia.org/w/api.php"
            f"?action=query&list=search&srsearch={place_name}&utf8=&format=json"
        )
        search_res = await client.get(search_url, timeout=5.0)
        if search_res.status_code != 200:
            return None, None

        search_results = search_res.json().get("query", {}).get("search", [])
        if not search_results:
            return None, None

        title = search_results[0]["title"]
        wiki_res = await client.get(
            f"https://en.wikipedia.org/api/rest_v1/page/summary/{title}",
            timeout=5.0,
        )
        if wiki_res.status_code != 200:
            return None, None

        data = wiki_res.json()
        description = data.get("extract") or None
        thumb = data.get("thumbnail", {})
        thumb_url = None
        if thumb and thumb.get("width", 0) >= 400 and thumb.get("height", 0) >= 250:
            thumb_url = thumb["source"]
        return thumb_url, description

    except Exception:
        return None, None


async def fetch_pexels_candidates(
    client: httpx.AsyncClient,
    place_name: str,
    n: int = 10,
) -> list:
    """
    Fetches up to *n* Pexels landscape photos for a destination and returns
    their URLs (large size preferred, medium as fallback).

    Returning multiple candidates is what makes per-batch deduplication
    possible: the caller can skip a URL already claimed by another destination.
    """
    pexels_key = os.getenv("PEXELS_API_KEY", "").strip()
    if not pexels_key:
        return []
    try:
        res = await client.get(
            "https://api.pexels.com/v1/search",
            headers={"Authorization": pexels_key},
            params={
                "query": f"{place_name} travel",
                "per_page": n,
                "orientation": "landscape",
            },
            timeout=8.0,
        )
        if res.status_code != 200:
            return []
        photos = res.json().get("photos", [])
        urls = []
        for p in photos:
            src = p.get("src", {})
            url = src.get("large") or src.get("medium") or src.get("original")
            if url:
                urls.append(url)
        return urls
    except Exception:
        return []


@router.delete("/cache/clear")

async def clear_image_cache():
    """
    Clears the in-memory image cache so the next search re-fetches
    fresh images from Wikipedia / Pexels.  Useful after changing the
    image-enrichment logic without restarting the server.
    """
    count = len(image_cache)
    image_cache.clear()
    places_cache.clear()
    return {"status": "cleared", "entries_removed": count}


@router.get("/places", response_model=List[Place])
async def get_places(
    city: str = Query(..., description="City to search in"),
    category: str = Query(..., description="Category: tourist, historical, food, adventure, hidden_gem")
):
    if category not in CATEGORY_FILTERS:
        raise HTTPException(status_code=400, detail="Invalid category")

    cache_key = f"{city}_{category}"
    current_time = time.time()

    # Check cache for full response
    if cache_key in places_cache:
        cached_data, timestamp = places_cache[cache_key]
        if current_time - timestamp < CACHE_TTL:
            return cached_data

    # Build Overpass QL query
    query = f"""[out:json][timeout:25];
area["name"="{city}"]["admin_level"="8"]->.a;
{CATEGORY_FILTERS[category]}
out body;"""

    # Fetch from Overpass API with fallbacks
    success = False
    data = None
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for endpoint in OVERPASS_ENDPOINTS:
            try:
                response = await client.post(endpoint, data={"data": query})
                response.raise_for_status()
                data = response.json()
                success = True
                break
            except (httpx.RequestError, httpx.HTTPStatusError):
                continue
                
    if not success or data is None:
        raise HTTPException(status_code=503, detail="Overpass API is currently unavailable")

    elements = data.get("elements", [])
    raw_places = []
    
    # Parse basic Overpass data
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name")
        if not name:
            continue
            
        lat = el.get("lat")
        lon = el.get("lon")
        if lat is None or lon is None:
            continue
            
        street = tags.get("addr:street", "")
        housenumber = tags.get("addr:housenumber", "")
        address = f"{housenumber} {street}".strip() or None
        
        raw_places.append({
            "name": name,
            "lat": lat,
            "lon": lon,
            "category": category,
            "address": address
        })

    # Enrich images in parallel
    async with httpx.AsyncClient(timeout=10.0) as enrich_client:
        tasks = [enrich_image(enrich_client, p["name"], category) for p in raw_places]
        image_results = await asyncio.gather(*tasks)

    # Combine into Pydantic models
    final_places = []
    for place_dict, (img_url, img_source, desc) in zip(raw_places, image_results):
        final_places.append(
            Place(
                name=place_dict["name"],
                lat=place_dict["lat"],
                lon=place_dict["lon"],
                category=place_dict["category"],
                description=desc,
                address=place_dict["address"],
                image_url=img_url,
                image_source=img_source
            )
        )

    places_cache[cache_key] = (final_places, current_time)
    return final_places
