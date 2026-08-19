import { useState, useEffect } from 'react';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80';

export default function PlaceCard({ place, isLiked = false, onToggleLike, onViewPhotos }) {
  const [scaleEff, setScaleEff] = useState(false);

  /**
   * imgSrc must stay in sync with place.image_url whenever the parent
   * passes a different place object (e.g. after a new search).
   * Using useEffect + key forces a reset when the image URL changes.
   */
  const [imgSrc, setImgSrc] = useState(place.image_url || FALLBACK_IMG);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Re-sync imgSrc if the parent swaps the place prop (new search result)
  useEffect(() => {
    setImgSrc(place.image_url || FALLBACK_IMG);
    setImgLoaded(false);
  }, [place.image_url]);

  const handleToggle = () => {
    setScaleEff(true);
    setTimeout(() => setScaleEff(false), 150);
    if (onToggleLike) onToggleLike(place);
  };

  const handleImgError = () => {
    if (imgSrc !== FALLBACK_IMG) setImgSrc(FALLBACK_IMG);
  };

  return (
    <div
      className="place-card group bg-white rounded-xl shadow-[0px_4px_20px_rgba(94,54,112,0.08)] border border-surface-container-high overflow-hidden transition-all duration-300 hover:bg-surface-container-low hover:translate-y-[-4px] flex flex-col"
      style={{ animation: 'fadeIn 0.3s ease-out forwards' }}
    >
      {/* ── Image area ─────────────────────────────────────────── */}
      <div className="relative h-52 w-full overflow-hidden bg-surface-container-low flex-shrink-0">
        {/* Skeleton shimmer shown while image loads */}
        {!imgLoaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-[#e8d8f0] via-[#f3e9f8] to-[#e8d8f0] animate-pulse" />
        )}

        <img
          key={imgSrc}                  /* force re-mount when URL changes */
          alt={place.name || 'Destination'}
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          src={imgSrc}
          onLoad={() => setImgLoaded(true)}
          onError={handleImgError}
          loading="lazy"
          crossOrigin="anonymous"
        />

        {/* Image source badge — bottom-left corner */}
        {place.image_source && place.image_source !== 'fallback' && imgLoaded && (
          <span className="absolute bottom-2 left-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-black/50 text-white backdrop-blur-sm capitalize tracking-wide">
            {place.image_source === 'pexels' ? '📷 Pexels' : place.image_source}
          </span>
        )}

        {/* Favourite heart — top-right corner */}
        <div className="absolute top-3 right-3">
          <button
            onClick={handleToggle}
            aria-label={isLiked ? 'Remove from favourites' : 'Add to favourites'}
            className={`w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center transition-all shadow-md transform ${
              scaleEff ? 'scale-125' : 'scale-100'
            } active:scale-90 ${isLiked ? 'text-[#5e3670]' : 'text-[#b98ecf] hover:text-[#5e3670]'}`}
          >
            <span className={`material-symbols-outlined text-[20px] ${isLiked ? 'heart-active' : ''}`}>
              favorite
            </span>
          </button>
        </div>
      </div>

      {/* ── Card body ─────────────────────────────────────────── */}
      <div className="p-4 flex flex-col flex-1 gap-1">

        {/* Destination name */}
        <h3 className="font-headline-md text-headline-md text-primary-container truncate leading-tight">
          {place.name}
        </h3>

        {/* Location row */}
        <div className="flex items-start text-on-surface-variant gap-1">
          <span className="material-symbols-outlined text-[14px] mt-0.5 flex-shrink-0">location_on</span>
          <span className="text-xs font-medium line-clamp-1 leading-snug">{place.address || '—'}</span>
        </div>

        {/* Description / tagline — primary new element */}
        {place.description && (
          <p className="text-[11.5px] text-on-surface-variant/80 leading-snug line-clamp-2 mt-0.5 italic">
            {place.description}
          </p>
        )}

        {/* Bottom row: Gem Score + View Photos */}
        <div className="flex items-center justify-between mt-auto pt-2 gap-2">
          {place.hidden_gem_score !== undefined && (
            <div className="flex items-center gap-1 bg-surface-container px-2 py-1 rounded-full">
              <span className="material-symbols-outlined text-[12px] text-primary">diamond</span>
              <span className="text-[11px] text-primary font-bold">
                {place.hidden_gem_score?.toFixed(1)}
              </span>
            </div>
          )}

          {/* View Photos button — opens full Pexels gallery */}
          {onViewPhotos && (
            <button
              onClick={() => onViewPhotos(place.name || place.title)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold text-[#5e3670] border border-[#c3a0d8] hover:bg-[#5e3670] hover:text-white hover:border-[#5e3670] transition-all duration-200 ml-auto"
              aria-label={`View more photos of ${place.name}`}
            >
              <span className="material-symbols-outlined text-[13px]">photo_library</span>
              Photos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
