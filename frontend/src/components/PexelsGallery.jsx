import { useState, useEffect, useCallback } from 'react';
import { fetchPlaceImages } from '../services/api';

/**
 * PexelsGallery
 * ─────────────
 * Fetches up to `count` photos from Pexels via the FastAPI backend and
 * displays them in a responsive grid with progressive "Load More" rendering.
 *
 * All photos are fetched in a single request and held in state.  Only
 * VISIBLE_BATCH photos are rendered at a time; the user can expand the
 * grid with the "Load More" button without any additional API calls.
 *
 * Props:
 *  • placeName  {string}  – required – destination name, e.g. "Matheran"
 *  • count      {number}  – optional – total photos to fetch (1-80, default 80)
 *  • className  {string}  – optional – extra CSS classes for the wrapper
 */

const VISIBLE_BATCH = 12; // how many photos to add per "Load More" click

export default function PexelsGallery({ placeName, count = 80, className = '' }) {
  // All photos fetched from the API
  const [allPhotos, setAllPhotos]   = useState([]);
  // How many of allPhotos are currently rendered in the grid
  const [visible, setVisible]       = useState(VISIBLE_BATCH);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [lightbox, setLightbox]     = useState(null); // index into allPhotos

  // Slice of allPhotos currently shown in the grid
  const visiblePhotos = allPhotos.slice(0, visible);
  const hasMore       = visible < allPhotos.length;

  const load = useCallback(async () => {
    if (!placeName) return;
    setLoading(true);
    setError(null);
    setVisible(VISIBLE_BATCH); // reset scroll position on new place
    try {
      const data = await fetchPlaceImages(placeName, count);
      setAllPhotos(data.photos || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load images.');
      setAllPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [placeName, count]);

  useEffect(() => { load(); }, [load]);

  // ── Keyboard nav for lightbox ────────────────────────────────────────────
  useEffect(() => {
    if (lightbox === null) return;
    const handler = (e) => {
      if (e.key === 'Escape')     setLightbox(null);
      if (e.key === 'ArrowRight') setLightbox((i) => Math.min(i + 1, allPhotos.length - 1));
      if (e.key === 'ArrowLeft')  setLightbox((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, allPhotos.length]);

  if (!placeName) return null;

  return (
    <div className={`pexels-gallery-root ${className}`}>

      {/* ── Header ── */}
      <div className="gallery-header">
        <div className="gallery-title-row">
          <span className="material-symbols-outlined gallery-icon">photo_library</span>
          <h3 className="gallery-title">Photos of {placeName}</h3>
          {/* Live photo count badge */}
          {!loading && allPhotos.length > 0 && (
            <span className="gallery-count-badge">
              {visiblePhotos.length} / {allPhotos.length}
            </span>
          )}
        </div>
        <p className="gallery-subtitle">Sourced live from Pexels · automatically fetched</p>
      </div>

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="gallery-grid">
          {Array.from({ length: VISIBLE_BATCH }).map((_, i) => (
            <div key={i} className="gallery-skeleton" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      )}

      {/* ── Error state ── */}
      {!loading && error && (
        <div className="gallery-error">
          <span className="material-symbols-outlined">broken_image</span>
          <p>{error}</p>
          <button className="gallery-retry-btn" onClick={load}>Retry</button>
        </div>
      )}

      {/* ── Photo grid ── */}
      {!loading && !error && visiblePhotos.length > 0 && (
        <>
          <div className="gallery-grid">
            {visiblePhotos.map((photo, idx) => (
              <button
                key={photo.id}
                className="gallery-item"
                onClick={() => setLightbox(idx)}
                aria-label={photo.alt || `Photo ${idx + 1} of ${placeName}`}
                style={{ '--avg': photo.avg_color || '#b98ecf' }}
              >
                <img
                  src={photo.medium}
                  alt={photo.alt || placeName}
                  className="gallery-img"
                  loading="lazy"
                />
                <div className="gallery-overlay">
                  <span className="material-symbols-outlined gallery-zoom-icon">zoom_in</span>
                </div>
              </button>
            ))}
          </div>

          {/* ── Load More button ── */}
          {hasMore && (
            <div className="gallery-load-more-row">
              <button
                className="gallery-load-more-btn"
                onClick={() => setVisible((v) => Math.min(v + VISIBLE_BATCH, allPhotos.length))}
              >
                <span className="material-symbols-outlined">expand_more</span>
                Load more photos
                <span className="gallery-load-more-count">
                  {allPhotos.length - visible} remaining
                </span>
              </button>
            </div>
          )}

          {/* ── All loaded indicator ── */}
          {!hasMore && allPhotos.length > VISIBLE_BATCH && (
            <p className="gallery-all-loaded">
              <span className="material-symbols-outlined">check_circle</span>
              All {allPhotos.length} photos shown
            </p>
          )}
        </>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && allPhotos.length === 0 && (
        <div className="gallery-empty">
          <span className="material-symbols-outlined">image_not_supported</span>
          <p>No photos found for <strong>{placeName}</strong></p>
        </div>
      )}

      {/* ── Attribution ── */}
      {allPhotos.length > 0 && (
        <p className="gallery-attribution">
          Photos by talented photographers on{' '}
          <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">
            Pexels
          </a>
        </p>
      )}

      {/* ── Lightbox ── */}
      {lightbox !== null && allPhotos[lightbox] && (
        <div
          className="lightbox-backdrop"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
        >
          <div className="lightbox-box" onClick={(e) => e.stopPropagation()}>
            {/* Close */}
            <button className="lightbox-close" onClick={() => setLightbox(null)} aria-label="Close">
              <span className="material-symbols-outlined">close</span>
            </button>

            {/* Prev */}
            <button
              className="lightbox-nav lightbox-prev"
              onClick={() => setLightbox((i) => Math.max(i - 1, 0))}
              disabled={lightbox === 0}
              aria-label="Previous photo"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>

            <img
              src={allPhotos[lightbox].large}
              alt={allPhotos[lightbox].alt || placeName}
              className="lightbox-img"
            />

            {/* Next */}
            <button
              className="lightbox-nav lightbox-next"
              onClick={() => setLightbox((i) => Math.min(i + 1, allPhotos.length - 1))}
              disabled={lightbox === allPhotos.length - 1}
              aria-label="Next photo"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>

            {/* Caption */}
            <div className="lightbox-caption">
              <p className="lightbox-alt">{allPhotos[lightbox].alt || placeName}</p>
              <a
                href={allPhotos[lightbox].photographer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="lightbox-credit"
              >
                📷 {allPhotos[lightbox].photographer}
              </a>
              <span className="lightbox-counter">{lightbox + 1} / {allPhotos.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
