import math
from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on the Earth
    in kilometers using the Haversine formula.
    """
    # Convert decimal degrees to radians
    r_lat1, r_lon1, r_lat2, r_lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    d_lat = r_lat2 - r_lat1
    d_lon = r_lon2 - r_lon1
    a = math.sin(d_lat / 2.0)**2 + math.cos(r_lat1) * math.cos(r_lat2) * math.sin(d_lon / 2.0)**2
    c = 2.0 * math.asin(math.sqrt(a))
    
    # Earth's radius in kilometers
    r = 6371.0
    return c * r

def get_hybrid_recommendations(
    destinations: List[Dict[str, Any]],
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
    search_query: Optional[str] = None,
    category_filter: Optional[str] = None,
    user_liked_categories: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Generate ranked travel recommendations using a hybrid AI model:
    1. Proximity Score (Haversine distance)
    2. Content-Based Similarity (TF-IDF vectorizer + Cosine similarity on descriptions, categories, titles)
    3. Category Preference Boost
    """
    if not destinations:
        return []

    # 1. Content-Based text document creation for each destination
    # We combine title, category, location, and description into a single text representation
    documents = []
    for d in destinations:
        combined_text = f"{d.get('title', '')} {d.get('category', '')} {d.get('location', '')} {d.get('description', '')}"
        documents.append(combined_text)

    # Initialize TF-IDF Vectorizer
    vectorizer = TfidfVectorizer(stop_words='english')
    
    try:
        tfidf_matrix = vectorizer.fit_transform(documents)
    except ValueError:
        # If vocabulary is empty (e.g. no destinations or invalid text)
        tfidf_matrix = None

    # Compute text similarity scores
    content_scores = np.zeros(len(destinations))
    
    if tfidf_matrix is not None:
        target_texts = []
        if search_query:
            target_texts.append(search_query)
        if user_liked_categories:
            target_texts.append(" ".join(user_liked_categories))
            
        if target_texts:
            target_profile = " ".join(target_texts)
            try:
                target_vector = vectorizer.transform([target_profile])
                similarities = cosine_similarity(target_vector, tfidf_matrix).flatten()
                content_scores = similarities
            except Exception:
                pass # Fallback to zeros on error

    # 2. Compute Proximity Scores and distances
    proximity_scores = np.zeros(len(destinations))
    distances = [None] * len(destinations)
    
    has_location = user_lat is not None and user_lon is not None
    
    for i, d in enumerate(destinations):
        coords = d.get("coordinates", {})
        dest_lat = coords.get("latitude")
        dest_lon = coords.get("longitude")
        
        if has_location and dest_lat is not None and dest_lon is not None:
            try:
                dist = haversine_distance(user_lat, user_lon, float(dest_lat), float(dest_lon))
                distances[i] = dist
                # Normalize distance to proximity score: 1.0 for 0km, approaching 0 as distance increases.
                # Use a scale factor (e.g., 500km) so that a destination 500km away gets a score of 0.5
                proximity_scores[i] = 1.0 / (1.0 + (dist / 500.0))
            except (ValueError, TypeError):
                distances[i] = None
                proximity_scores[i] = 0.0
        else:
            # If no location supplied, all places get a neutral proximity score
            proximity_scores[i] = 0.5

    # 3. Calculate Category Matching & Boosts
    category_scores = np.zeros(len(destinations))
    for i, d in enumerate(destinations):
        dest_cat = d.get("category", "").lower()
        score = 0.0
        
        # Explicit category filter requested
        if category_filter and dest_cat == category_filter.lower():
            score += 0.6
            
        # User liked category matches
        if user_liked_categories:
            user_liked_cats_lower = [c.lower() for c in user_liked_categories]
            if dest_cat in user_liked_cats_lower:
                score += 0.4
                
        category_scores[i] = min(score, 1.0)

    # 4. Synthesize Hybrid Score
    # Weight settings: Content (40%), Location Proximity (40%), Category Matching (20%)
    w_content = 0.4
    w_proximity = 0.4
    w_category = 0.2
    
    # Adjust weights if location is not provided (re-distribute proximity weight to content and category)
    if not has_location:
        w_content = 0.6
        w_proximity = 0.0
        w_category = 0.4

    recommended_list = []
    for i, d in enumerate(destinations):
        # Calculate hybrid score
        ai_score = (w_content * content_scores[i]) + (w_proximity * proximity_scores[i]) + (w_category * category_scores[i])
        
        # Build recommendation object
        rec = d.copy()
        rec["id"] = rec.get("id")
        rec["ai_score"] = float(round(ai_score, 4))
        rec["distance_km"] = float(round(distances[i], 2)) if distances[i] is not None else None
        recommended_list.append(rec)

    # Sort by AI score descending
    recommended_list.sort(key=lambda x: x["ai_score"], reverse=True)
    
    return recommended_list
