import { useState, useCallback } from 'react';

const STORAGE_KEY = 'travigo_liked_places';

/**
 * Returns a stable key for a place object regardless of whether it came
 * from the Geoapify search API or the local DB.
 */
function placeKey(place) {
  // Use coordinates as unique identifier since API results lack a DB id
  if (place.coordinates?.latitude !== undefined && place.coordinates?.longitude !== undefined) {
    return `${place.coordinates.latitude}_${place.coordinates.longitude}`;
  }
  return place.name || JSON.stringify(place);
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(places) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  } catch {
    // localStorage may be unavailable in some environments
  }
}

export function useLikedPlaces() {
  const [likedPlaces, setLikedPlaces] = useState(() => load());

  const isLiked = useCallback(
    (place) => likedPlaces.some((p) => placeKey(p) === placeKey(place)),
    [likedPlaces]
  );

  const toggleLike = useCallback((place) => {
    setLikedPlaces((prev) => {
      const key = placeKey(place);
      const exists = prev.some((p) => placeKey(p) === key);
      const next = exists ? prev.filter((p) => placeKey(p) !== key) : [...prev, place];
      save(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setLikedPlaces([]);
    save([]);
  }, []);

  return { likedPlaces, isLiked, toggleLike, clearAll };
}
