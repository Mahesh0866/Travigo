from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
import httpx
import asyncio
from typing import List, Optional
from app.places import fetch_wiki_summary, fetch_pexels_candidates, FALLBACK_IMAGES

from app.database import get_db, Destination
from app.config import settings
from app.recommendation import haversine_distance
from app.activity import log_activity, Actions

router = APIRouter()

class SearchQuery(BaseModel):
    query: str
    limit: Optional[int] = 8
    offset: Optional[int] = 0

INTENT_MAPPING = {
    "trekking": "sport",
    "beach": "natural",
    "historical": "tourism.sights",
    "food": "catering.restaurant",
    "temple": "tourism.sights.place_of_worship.temple",
}
DEFAULT_CATEGORY = "tourism.attraction"

# Curated taglines used when Wikipedia cannot supply a description
CATEGORY_TAGLINES: dict = {
    "tourism.attraction":                      "A captivating landmark worth adding to your itinerary",
    "tourist":                                 "A popular destination rich in culture and local character",
    "tourism.sights":                          "Iconic sights and timeless stories await the curious traveller",
    "tourism.sights.place_of_worship.temple":  "A serene spiritual sanctuary steeped in centuries of devotion",
    "historical":                              "Step back in time at this storied historic site",
    "natural":                                 "Pristine natural beauty waiting to be discovered off the beaten path",
    "sport":                                   "An outdoor playground for adventure seekers and thrill lovers",
    "catering.restaurant":                     "Savour authentic local flavours at this beloved culinary gem",
    "food":                                    "A foodie's paradise brimming with fresh, local ingredients",
    "hidden_gem":                              "A hidden gem most tourists miss — your secret awaits",
    "default":                                 "Discover this unique travel destination and make it your own",
}

MAX_DESC_CHARS = 160  # trim Wikipedia extracts to this length

def generate_tagline(category: str) -> str:
    """Return a curated tagline for a given Geoapify category string."""
    # Try exact match first, then prefix match, then default
    if category in CATEGORY_TAGLINES:
        return CATEGORY_TAGLINES[category]
    for key in CATEGORY_TAGLINES:
        if category.startswith(key) or key.startswith(category):
            return CATEGORY_TAGLINES[key]
    return CATEGORY_TAGLINES["default"]

def parse_query(query: str):
    words = query.lower().split()
    intent = None
    city_words = []
    
    for word in words:
        matched = False
        for key in INTENT_MAPPING.keys():
            if key in word:
                intent = key
                matched = True
                break
        
        if not matched and word not in ["places", "in", "near", "best", "top"]:
            city_words.append(word)
            
    city = " ".join(city_words)
    return city, intent

def calculate_hidden_gem_score(place: dict, city_lat: float, city_lon: float) -> float:
    # Score higher if it lacks a Wikipedia/Wikidata reference
    score = 50.0
    
    properties = place.get("properties", {})
    datasource = properties.get("datasource", {}).get("raw", {})
    
    # Check for wiki references (indicates it's famous)
    if "wikipedia" in datasource or "wikidata" in datasource or properties.get("wiki_and_media"):
        score -= 20.0
    else:
        score += 20.0
        
    # Factor in distance from city center
    lat = properties.get("lat")
    lon = properties.get("lon")
    if lat is not None and lon is not None:
        try:
            dist = haversine_distance(city_lat, city_lon, float(lat), float(lon))
            # Farther away from city center might mean it's more of a hidden gem, reward it up to a point
            score += min(dist, 30.0) * 0.5 
        except Exception:
            pass
            
    return score

@router.post("/search-places")
async def search_places(payload: SearchQuery, db: AsyncSession = Depends(get_db)):
    query = payload.query
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    # Log the search query to the activity trail (best-effort, fire and forget style)
    await log_activity(
        db, action=Actions.USER_SEARCH,
        detail=f"User searched: {query.strip()}",
        actor_type="user",
        metadata={"query": query.strip(), "limit": payload.limit, "offset": payload.offset},
    )
    await db.commit()

    city, intent = parse_query(query)
    if not city:
        raise HTTPException(status_code=400, detail="Could not extract city from query")

    category = INTENT_MAPPING.get(intent, DEFAULT_CATEGORY) if intent else DEFAULT_CATEGORY
    
    api_key = settings.geoapify_api_key
    if not api_key:
        raise HTTPException(status_code=500, detail="Geoapify API key not configured")
        
    async with httpx.AsyncClient() as client:
        # 1. Geocoding
        try:
            geocode_url = f"https://api.geoapify.com/v1/geocode/search?text={city}&format=json&apiKey={api_key}"
            geo_res = await client.get(geocode_url)
            geo_res.raise_for_status()
            geo_data = geo_res.json()
            results = geo_data.get("results", [])
            if not results:
                raise HTTPException(status_code=404, detail="City not found")
                
            city_lat = results[0]["lat"]
            city_lon = results[0]["lon"]
        except httpx.HTTPError:
            raise HTTPException(status_code=500, detail="Geocoding API error")
            
        # 2. Places API
        try:
            places_url = f"https://api.geoapify.com/v2/places?categories={category}&filter=circle:{city_lon},{city_lat},15000&limit={payload.limit}&offset={payload.offset}&apiKey={api_key}"
            places_res = await client.get(places_url)
            places_res.raise_for_status()
            places_data = places_res.json()
            features = places_data.get("features", [])
        except httpx.HTTPError:
            raise HTTPException(status_code=500, detail="Places API error")
            
    formatted_results = []
    if features:
        for f in features:
            props = f.get("properties", {})
            name = props.get("name") or props.get("formatted") or "Unknown Place"
            
            score = calculate_hidden_gem_score(f, city_lat, city_lon)
            
            formatted_results.append({
                "name": name,
                "category": category,
                "coordinates": {"latitude": props.get("lat"), "longitude": props.get("lon")},
                "address": props.get("formatted"),
                "hidden_gem_score": score,
                "image_url": None,
                "image_source": None,
                "description": None,   # filled in after image enrichment
            })

    # ── Phase 1: Parallel fetch – Wikipedia summary + Pexels candidate pool ──────
    # Each destination gets up to 10 Pexels landscape photos to choose from.
    # Fetching in parallel keeps total latency low.
    if formatted_results:
        async with httpx.AsyncClient(timeout=12.0) as enrich_client:
            wiki_tasks   = [fetch_wiki_summary(enrich_client, item["name"])        for item in formatted_results]
            pexels_tasks = [fetch_pexels_candidates(enrich_client, item["name"], 10) for item in formatted_results]

            # Run both batches concurrently
            all_wiki_results, all_pexels_results = await asyncio.gather(
                asyncio.gather(*wiki_tasks),
                asyncio.gather(*pexels_tasks),
            )

        # ── Phase 2: Sequential deduplication ────────────────────────────────────
        # Walk through every destination in order and pick the first Pexels URL
        # not yet claimed by an earlier card.  If all candidates are exhausted,
        # fall back to the category-level static image.
        used_urls: set = set()

        for item, (wiki_thumb, wiki_desc), pexels_candidates in zip(
            formatted_results, all_wiki_results, all_pexels_results
        ):
            # Build candidate list: Pexels first (better quality/variety), wiki thumbnail appended
            candidates = list(pexels_candidates)  # copy so we don't mutate the fetched list
            if wiki_thumb and wiki_thumb not in candidates:
                candidates.append(wiki_thumb)

            # Pick the first URL that hasn't been used by another destination in this batch
            chosen_url    = None
            chosen_source = "fallback"
            for url in candidates:
                if url not in used_urls:
                    chosen_url    = url
                    chosen_source = "pexels" if url in pexels_candidates else "wikipedia"
                    used_urls.add(url)
                    break

            # If every candidate is already taken, use the category static fallback
            item["image_url"]    = chosen_url or FALLBACK_IMAGES.get(
                item["category"], FALLBACK_IMAGES["default"]
            )
            item["image_source"] = chosen_source

            # Description: prefer Wikipedia extract (trimmed), else curated tagline
            if wiki_desc:
                trimmed = wiki_desc[:MAX_DESC_CHARS]
                if len(wiki_desc) > MAX_DESC_CHARS:
                    last_space = trimmed.rfind(" ")
                    trimmed = (trimmed[:last_space] if last_space > 0 else trimmed) + "\u2026"
                item["description"] = trimmed
            else:
                item["description"] = generate_tagline(item["category"])

            
    # 3. Query SQLite database for manually curated places (only on first page)
    if payload.offset == 0:
        try:
            db_results = await db.execute(select(Destination).where(Destination.location.ilike(f"%{city}%")))
            db_destinations = db_results.scalars().all()
            
            for db_dest in db_destinations:
                # Check if intent matches the manually added destination category loosely
                if intent and intent.lower() not in db_dest.category.lower() and db_dest.category.lower() not in category.lower():
                    continue
                    
                formatted_results.append({
                    "name": db_dest.title,
                    "category": db_dest.category,
                    "coordinates": {"latitude": db_dest.latitude, "longitude": db_dest.longitude},
                    "address": db_dest.location,
                    "hidden_gem_score": 100.0,  # High score for curated hidden gems
                    "image_url": db_dest.image_url,
                    "image_source": "database",
                    "description": (
                        db_dest.description[:MAX_DESC_CHARS] + "…"
                        if db_dest.description and len(db_dest.description) > MAX_DESC_CHARS
                        else db_dest.description
                    ) or generate_tagline(db_dest.category),
                })
        except Exception:
            pass
        
    if not formatted_results:
        raise HTTPException(status_code=404, detail="No places found for the given criteria")
        
    # Sort results by hidden-gem score (descending)
    formatted_results.sort(key=lambda x: x["hidden_gem_score"], reverse=True)
    
    return formatted_results


# ── Curated Top Travel Destinations ──────────────────────────────────────────
# Used for instant prefix matching of popular tourist spots
CURATED_DESTINATIONS = [
    {"name": "Matheran", "formatted": "Matheran, Maharashtra, India", "city": "Matheran", "state": "Maharashtra", "country": "India", "category": "Hill Station"},
    {"name": "Mathura", "formatted": "Mathura, Uttar Pradesh, India", "city": "Mathura", "state": "Uttar Pradesh", "country": "India", "category": "Heritage & Temple"},
    {"name": "Manali", "formatted": "Manali, Himachal Pradesh, India", "city": "Manali", "state": "Himachal Pradesh", "country": "India", "category": "Adventure & Mountain"},
    {"name": "Mangalore", "formatted": "Mangalore, Karnataka, India", "city": "Mangalore", "state": "Karnataka", "country": "India", "category": "Coastal City"},
    {"name": "Mahabaleshwar", "formatted": "Mahabaleshwar, Maharashtra, India", "city": "Mahabaleshwar", "state": "Maharashtra", "country": "India", "category": "Hill Station"},
    {"name": "Mount Abu", "formatted": "Mount Abu, Rajasthan, India", "city": "Mount Abu", "state": "Rajasthan", "country": "India", "category": "Hill Station"},
    {"name": "Munnar", "formatted": "Munnar, Kerala, India", "city": "Munnar", "state": "Kerala", "country": "India", "category": "Tea Gardens & Nature"},
    {"name": "Mysore", "formatted": "Mysore, Karnataka, India", "city": "Mysore", "state": "Karnataka", "country": "India", "category": "Heritage City"},
    {"name": "Mandu", "formatted": "Mandu, Madhya Pradesh, India", "city": "Mandu", "state": "Madhya Pradesh", "country": "India", "category": "Historical Forts"},
    {"name": "Madurai", "formatted": "Madurai, Tamil Nadu, India", "city": "Madurai", "state": "Tamil Nadu", "country": "India", "category": "Temple City"},
    {"name": "Goa", "formatted": "Goa, India", "city": "Goa", "state": "Goa", "country": "India", "category": "Beach & Nightlife"},
    {"name": "Udaipur", "formatted": "Udaipur, Rajasthan, India", "city": "Udaipur", "state": "Rajasthan", "country": "India", "category": "Lakes & Palaces"},
    {"name": "Jaipur", "formatted": "Jaipur, Rajasthan, India", "city": "Jaipur", "state": "Rajasthan", "country": "India", "category": "Pink City & Heritage"},
    {"name": "Jaisalmer", "formatted": "Jaisalmer, Rajasthan, India", "city": "Jaisalmer", "state": "Rajasthan", "country": "India", "category": "Desert & Fort"},
    {"name": "Jodhpur", "formatted": "Jodhpur, Rajasthan, India", "city": "Jodhpur", "state": "Rajasthan", "country": "India", "category": "Blue City & Forts"},
    {"name": "Agra", "formatted": "Agra, Uttar Pradesh, India", "city": "Agra", "state": "Uttar Pradesh", "country": "India", "category": "Monuments & Heritage"},
    {"name": "Varanasi", "formatted": "Varanasi, Uttar Pradesh, India", "city": "Varanasi", "state": "Uttar Pradesh", "country": "India", "category": "Spiritual Ghats"},
    {"name": "Rishikesh", "formatted": "Rishikesh, Uttarakhand, India", "city": "Rishikesh", "state": "Uttarakhand", "country": "India", "category": "Yoga & Adventure"},
    {"name": "Shimla", "formatted": "Shimla, Himachal Pradesh, India", "city": "Shimla", "state": "Himachal Pradesh", "country": "India", "category": "Hill Station"},
    {"name": "Shirdi", "formatted": "Shirdi, Maharashtra, India", "city": "Shirdi", "state": "Maharashtra", "country": "India", "category": "Pilgrimage"},
    {"name": "Darjeeling", "formatted": "Darjeeling, West Bengal, India", "city": "Darjeeling", "state": "West Bengal", "country": "India", "category": "Tea Hills & Mountains"},
    {"name": "Ooty", "formatted": "Ooty, Tamil Nadu, India", "city": "Ooty", "state": "Tamil Nadu", "country": "India", "category": "Hill Station"},
    {"name": "Kodaikanal", "formatted": "Kodaikanal, Tamil Nadu, India", "city": "Kodaikanal", "state": "Tamil Nadu", "country": "India", "category": "Lakes & Hills"},
    {"name": "Leh Ladakh", "formatted": "Leh Ladakh, Ladakh, India", "city": "Leh", "state": "Ladakh", "country": "India", "category": "High Passes & Monasteries"},
    {"name": "Kashmir", "formatted": "Kashmir Valley, Jammu & Kashmir, India", "city": "Srinagar", "state": "Jammu & Kashmir", "country": "India", "category": "Valleys & Lakes"},
    {"name": "Pondicherry", "formatted": "Puducherry, India", "city": "Puducherry", "state": "Puducherry", "country": "India", "category": "French Quarter & Beach"},
    {"name": "Ranthambore", "formatted": "Ranthambore, Rajasthan, India", "city": "Sawai Madhopur", "state": "Rajasthan", "country": "India", "category": "Wildlife Safari"},
    {"name": "Hampi", "formatted": "Hampi, Karnataka, India", "city": "Hampi", "state": "Karnataka", "country": "India", "category": "UNESCO World Heritage"},
    {"name": "Coorg", "formatted": "Coorg, Karnataka, India", "city": "Madikeri", "state": "Karnataka", "country": "India", "category": "Coffee Plantations"},
    {"name": "Alleppey", "formatted": "Alappuzha, Kerala, India", "city": "Alappuzha", "state": "Kerala", "country": "India", "category": "Backwaters & Houseboats"},
    {"name": "Kochi", "formatted": "Kochi, Kerala, India", "city": "Kochi", "state": "Kerala", "country": "India", "category": "Coastal Heritage"},
    {"name": "Amritsar", "formatted": "Amritsar, Punjab, India", "city": "Amritsar", "state": "Punjab", "country": "India", "category": "Golden Temple & Culture"},
    {"name": "Haridwar", "formatted": "Haridwar, Uttarakhand, India", "city": "Haridwar", "state": "Uttarakhand", "country": "India", "category": "Holy Ganges Ghats"},
    {"name": "Nainital", "formatted": "Nainital, Uttarakhand, India", "city": "Nainital", "state": "Uttarakhand", "country": "India", "category": "Lake City & Hills"},
    {"name": "Gokarna", "formatted": "Gokarna, Karnataka, India", "city": "Gokarna", "state": "Karnataka", "country": "India", "category": "Beaches & Temples"},
    {"name": "Khajuraho", "formatted": "Khajuraho, Madhya Pradesh, India", "city": "Khajuraho", "state": "Madhya Pradesh", "country": "India", "category": "Sculptured Temples"},
    {"name": "Puri", "formatted": "Puri, Odisha, India", "city": "Puri", "state": "Odisha", "country": "India", "category": "Beach & Jagannath Temple"},
]


@router.get("/destination-suggestions")
async def get_destination_suggestions(
    q: str,
    limit: Optional[int] = 6,
    db: AsyncSession = Depends(get_db),
):
    """
    Real-time destination suggestions endpoint.
    Returns relevant destination/place names matching the search prefix.
    Combines curated spots, database packages & destinations, and Geoapify Autocomplete API.
    """
    clean_q = q.strip()
    if not clean_q:
        return []

    q_lower = clean_q.lower()
    suggestions = []
    seen_names = set()

    # 1. Check Curated Top Destinations (exact prefix or substring)
    # Give priority to matches where name starts with query
    curated_prefix = []
    curated_sub = []
    for dest in CURATED_DESTINATIONS:
        dest_name_lower = dest["name"].lower()
        if dest_name_lower.startswith(q_lower):
            curated_prefix.append(dest)
        elif q_lower in dest_name_lower or q_lower in dest["formatted"].lower():
            curated_sub.append(dest)

    for dest in (curated_prefix + curated_sub):
        key = dest["name"].lower()
        if key not in seen_names:
            seen_names.add(key)
            suggestions.append({
                "name": dest["name"],
                "formatted": dest["formatted"],
                "city": dest.get("city", dest["name"]),
                "state": dest.get("state"),
                "country": dest.get("country", "India"),
                "category": dest.get("category", "Popular Destination"),
            })
            if len(suggestions) >= (limit or 6):
                return suggestions

    # 2. Check Database Destinations & Packages
    try:
        from app.database import TravelPackage
        # Search Travel Packages
        pkg_res = await db.execute(
            select(TravelPackage.destination)
            .where(TravelPackage.destination.ilike(f"%{clean_q}%"))
            .distinct()
        )
        for pkg_dest in pkg_res.scalars().all():
            if pkg_dest and pkg_dest.lower() not in seen_names:
                seen_names.add(pkg_dest.lower())
                suggestions.append({
                    "name": pkg_dest,
                    "formatted": f"{pkg_dest} (Travel Package)",
                    "city": pkg_dest,
                    "state": None,
                    "country": "India",
                    "category": "Tour Package",
                })
                if len(suggestions) >= (limit or 6):
                    return suggestions

        # Search Database Custom Destinations
        db_res = await db.execute(
            select(Destination)
            .where(
                Destination.title.ilike(f"%{clean_q}%") |
                Destination.location.ilike(f"%{clean_q}%")
            )
            .limit(4)
        )
        for d in db_res.scalars().all():
            if d.title and d.title.lower() not in seen_names:
                seen_names.add(d.title.lower())
                suggestions.append({
                    "name": d.title,
                    "formatted": d.location or d.title,
                    "city": d.title,
                    "state": None,
                    "country": "India",
                    "category": d.category or "Tourist Attraction",
                })
                if len(suggestions) >= (limit or 6):
                    return suggestions
    except Exception:
        pass

    # 3. Geoapify Autocomplete API for general place / city suggestions
    api_key = settings.geoapify_api_key
    if api_key:
        try:
            import urllib.parse
            encoded_q = urllib.parse.quote(clean_q)
            # Query Geoapify autocomplete for cities/places
            url = f"https://api.geoapify.com/v1/geocode/autocomplete?text={encoded_q}&limit=6&apiKey={api_key}"
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    geo_data = res.json()
                    features = geo_data.get("features", [])
                    for feat in features:
                        props = feat.get("properties", {})
                        raw_name = props.get("city") or props.get("name") or props.get("formatted", "")
                        if not raw_name:
                            continue
                        clean_name = raw_name.split(",")[0].strip()
                        key = clean_name.lower()
                        if key not in seen_names and len(clean_name) >= 2:
                            seen_names.add(key)
                            suggestions.append({
                                "name": clean_name,
                                "formatted": props.get("formatted", clean_name),
                                "city": props.get("city") or clean_name,
                                "state": props.get("state"),
                                "country": props.get("country"),
                                "category": props.get("result_type", "City / Place").capitalize(),
                            })
                            if len(suggestions) >= (limit or 6):
                                break
        except Exception:
            pass

    return suggestions[: (limit or 6)]
