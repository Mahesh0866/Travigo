import { useState, useEffect, useRef } from 'react';
import { getPopularPlaces } from '../services/api';
import PlaceCard from './PlaceCard';

export default function PopularPlaces({ isLiked, onToggleLike, onViewPhotos }) {
  const [popularPlaces, setPopularPlaces] = useState([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [error, setError]                 = useState(null);
  const scrollContainerRef                = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPopular = async () => {
      try {
        setIsLoading(true);
        const data = await getPopularPlaces();
        if (isMounted) {
          setPopularPlaces(data || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.detail || 'Failed to load popular places.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    fetchPopular();
    return () => { isMounted = false; };
  }, []);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // If loading complete and no places returned, hide the section gracefully
  if (!isLoading && !error && popularPlaces.length === 0) {
    return null;
  }

  return (
    <section className="py-lg bg-surface-container-lowest border-b border-surface-container-high/60 overflow-hidden">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-lg">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-lg gap-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🔥</span>
              <h2 className="font-headline-md text-headline-md text-primary font-bold">
                Popular Places
              </h2>
              <span className="bg-[#5e3670]/10 text-[#5e3670] text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Trending
              </span>
            </div>
            <p className="text-on-surface-variant text-sm mt-0.5">
              Loved by fellow travelers & top-rated destinations
            </p>
          </div>

          {/* Desktop Scroll Buttons */}
          {popularPlaces.length > 0 && !isLoading && (
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => scroll('left')}
                className="w-9 h-9 rounded-full border border-surface-container-high bg-white hover:bg-surface-container text-primary flex items-center justify-center transition-all shadow-sm active:scale-95"
                aria-label="Scroll left"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <button
                onClick={() => scroll('right')}
                className="w-9 h-9 rounded-full border border-surface-container-high bg-white hover:bg-surface-container text-primary flex items-center justify-center transition-all shadow-sm active:scale-95"
                aria-label="Scroll right"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          )}
        </div>

        {/* Skeleton Loader State */}
        {isLoading && (
          <div className="flex gap-gutter overflow-x-auto hide-scrollbar pb-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="min-w-[280px] sm:min-w-[320px] max-w-[340px] flex-shrink-0 bg-white rounded-xl h-[360px] border border-surface-container-high p-4 flex flex-col gap-3 animate-pulse"
              >
                <div className="w-full h-48 bg-surface-container-low rounded-lg" />
                <div className="h-5 bg-surface-container-low rounded w-3/4" />
                <div className="h-4 bg-surface-container-low rounded w-1/2" />
                <div className="h-4 bg-surface-container-low rounded w-full mt-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="bg-error-container text-on-error-container p-4 rounded-xl text-center text-sm">
            {error}
          </div>
        )}

        {/* Popular Places Horizontal Scroll Row */}
        {!isLoading && !error && popularPlaces.length > 0 && (
          <div
            ref={scrollContainerRef}
            className="flex gap-gutter overflow-x-auto hide-scrollbar pb-4 pt-1 snap-x snap-mandatory scroll-smooth"
          >
            {popularPlaces.map((place, idx) => (
              <div
                key={place.id || idx}
                className="min-w-[280px] sm:min-w-[320px] max-w-[340px] flex-shrink-0 snap-start"
              >
                <PlaceCard
                  place={place}
                  isLiked={isLiked ? isLiked(place) : false}
                  onToggleLike={onToggleLike}
                  onViewPhotos={onViewPhotos}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
