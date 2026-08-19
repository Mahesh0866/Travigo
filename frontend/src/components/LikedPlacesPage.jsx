import { useLikedPlaces } from '../hooks/useLikedPlaces';
import PlaceCard from './PlaceCard';

export default function LikedPlacesPage() {
  const { likedPlaces, isLiked, toggleLike, clearAll } = useLikedPlaces();

  return (
    <section className="py-xl max-w-container-max mx-auto px-margin-mobile md:px-lg min-h-[400px]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-xl gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-primary">My Favourite Places</h2>
          <p className="text-on-surface-variant font-body-md mt-xs">
            {likedPlaces.length > 0
              ? `${likedPlaces.length} place${likedPlaces.length !== 1 ? 's' : ''} saved`
              : 'Heart a place on the home page to save it here'}
          </p>
        </div>
        {likedPlaces.length > 0 && (
          <button
            onClick={clearAll}
            className="text-sm text-on-surface-variant hover:text-error transition-colors flex items-center gap-xs"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
            Clear all
          </button>
        )}
      </div>

      {likedPlaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 gap-md text-on-surface-variant">
          <span className="material-symbols-outlined text-[64px] text-primary/30">favorite</span>
          <p className="font-body-md text-center">No favourites yet. Start exploring!</p>
          <a
            href="/"
            className="mt-2 bg-primary text-on-primary px-lg py-sm rounded-xl font-label-md shadow-md hover:opacity-90 transition-opacity"
          >
            Discover Places
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {likedPlaces.map((place, idx) => (
            <PlaceCard
              key={idx}
              place={place}
              isLiked={isLiked(place)}
              onToggleLike={toggleLike}
            />
          ))}
        </div>
      )}
    </section>
  );
}
