import { useState, useRef } from 'react';
import { searchPlaces } from './services/api';
import { useLikedPlaces } from './hooks/useLikedPlaces';

import Header from './components/Header';
import Drawer from './components/Drawer';
import Hero from './components/Hero';
import PopularPlaces from './components/PopularPlaces';
import PlaceCard from './components/PlaceCard';
import Footer from './components/Footer';
import LikedPlacesPage from './components/LikedPlacesPage';
import ContactPage from './pages/ContactPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import PexelsGallery from './components/PexelsGallery';
import PackagesPage from './pages/PackagesPage';
import MyBookingsPage from './pages/MyBookingsPage';
import AdminPage from './pages/AdminPage';
import AdminLoginPage from './pages/AdminLoginPage';

const PAGE_SIZE = 8;

function App() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const [places, setPlaces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentQuery, setCurrentQuery] = useState(''); // the last-submitted query
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // ── Pexels gallery state ──────────────────────────────────
  const [galleryPlace, setGalleryPlace] = useState(null); // name of selected place
  const galleryRef = useRef(null);
  const resultsRef = useRef(null);

  const { isLiked, toggleLike } = useLikedPlaces();

  const toggleDrawer = () => setIsDrawerOpen(!isDrawerOpen);

  // Handle the query input changing — clear results if the bar is emptied
  const handleQueryChange = (val) => {
    setQuery(val);
    if (!val.trim()) {
      setPlaces([]);
      setHasSearched(false);
      setCurrentQuery('');
      setOffset(0);
      setHasMore(false);
      setError(null);
    }
  };

  const handleSearch = async (targetQuery) => {
    const q = (typeof targetQuery === 'string' ? targetQuery : query).trim();
    if (!q) return;
    if (typeof targetQuery === 'string') {
      setQuery(targetQuery);
    }
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setCurrentQuery(q);
    setOffset(0);
    setHasMore(false);
    setGalleryPlace(null);

    try {
      const data = await searchPlaces(q, PAGE_SIZE, 0);
      setPlaces(data);
      setHasMore(data.length === PAGE_SIZE);
      // Scroll results into view smoothly
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 404) {
        setPlaces([]);
        setError(null); // treat 404 as "no results" not an error
      } else {
        setError(detail || 'Failed to fetch places. Please try again.');
        setPlaces([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewMore = async () => {
    const nextOffset = offset + PAGE_SIZE;
    setIsLoadingMore(true);
    try {
      const more = await searchPlaces(currentQuery, PAGE_SIZE, nextOffset);
      setPlaces((prev) => [...prev, ...more]);
      setOffset(nextOffset);
      setHasMore(more.length === PAGE_SIZE);
    } catch (err) {
      // If 404, just hide the button – no more results
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  /**
   * Called when user clicks "View Photos" on a PlaceCard.
   * Opens the PexelsGallery section and smooth-scrolls to it.
   */
  const handleViewPhotos = (placeName) => {
    setGalleryPlace(placeName);
    setTimeout(() => {
      galleryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  // ── Routing ────────────────────────────────────────────────
  const path = window.location.pathname;
  const isLikedPage = path === '/liked';
  const isContactPage = path === '/contact';
  const isLoginPage = path === '/login';
  const isProfilePage = path === '/profile';
  const isPackagesPage = path === '/packages';
  const isMyBookings = path === '/my-bookings';
  const isAdminPage = path === '/admin';
  const isAdminLoginPage = path === '/admin-login';

  // Pages that should NOT show the main header/footer shell (admin is fullscreen)
  const isAdminRoute = isAdminPage || isAdminLoginPage;

  const renderPage = () => {
    if (isLikedPage) return <LikedPlacesPage />;
    if (isContactPage) return <ContactPage />;
    if (isLoginPage) return <LoginPage />;
    if (isProfilePage) return <ProfilePage />;
    if (isPackagesPage) return <PackagesPage />;
    if (isMyBookings) return <MyBookingsPage />;
    if (isAdminPage) return <AdminPage />;
    if (isAdminLoginPage) return <AdminLoginPage />;

    // ── Home page ──────────────────────────────────────────
    return (
      <>
        {/* 1 ── Hero / Search bar */}
        <Hero query={query} setQuery={handleQueryChange} onSearch={handleSearch} />

        {/* 2 ── Search Results (only when a search has been submitted) */}
        {hasSearched && (
          <section
            ref={resultsRef}
            className="py-xl max-w-container-max mx-auto px-margin-mobile md:px-lg"
          >
            {/* Section heading */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-xl gap-md">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-primary flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary text-[28px]">travel_explore</span>
                  Search Results for &ldquo;{currentQuery}&rdquo;
                </h2>
                <p className="text-on-surface-variant font-body-md mt-xs">
                  {places.length > 0
                    ? `${places.length} curated spot${places.length !== 1 ? 's' : ''} matching your search`
                    : 'No destinations found — try a different search term'}
                </p>
              </div>

              {hasSearched && places.length > 0 && (
                <button
                  onClick={() => {
                    setPlaces([]);
                    setHasSearched(false);
                    setQuery('');
                    setCurrentQuery('');
                    setOffset(0);
                    setHasMore(false);
                    setError(null);
                  }}
                  className="flex items-center gap-xs text-on-surface-variant font-label-sm text-label-sm hover:text-error transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                  Clear search
                </button>
              )}
            </div>

            {/* Loading spinner */}
            {isLoading && (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
              </div>
            )}

            {/* API error */}
            {!isLoading && error && (
              <div className="bg-error-container text-on-error-container p-4 rounded-xl text-center">
                {error}
              </div>
            )}

            {/* Results grid */}
            {!isLoading && !error && places.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
                  {places.map((place, idx) => (
                    <PlaceCard
                      key={`${place.name}-${idx}`}
                      place={place}
                      isLiked={isLiked(place)}
                      onToggleLike={toggleLike}
                      onViewPhotos={handleViewPhotos}
                    />
                  ))}
                </div>

                {/* ── View More button ── */}
                {hasMore && (
                  <div className="flex justify-center mt-xl">
                    <button
                      onClick={handleViewMore}
                      disabled={isLoadingMore}
                      className="inline-flex items-center gap-sm px-xl py-md bg-primary text-on-primary font-label-md text-label-md rounded-xl shadow-md hover:bg-primary/90 active:scale-95 transition-all duration-200 disabled:opacity-60"
                    >
                      {isLoadingMore ? (
                        <>
                          <span className="animate-spin material-symbols-outlined text-[20px]">progress_activity</span>
                          Loading…
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[20px]">expand_more</span>
                          View More in &ldquo;{currentQuery}&rdquo;
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* No results */}
            {!isLoading && !error && hasSearched && places.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-lg text-center">
                <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[40px] text-on-surface-variant">location_off</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">No destinations found</h3>
                  <p className="text-on-surface-variant font-body-md max-w-sm mx-auto">
                    We couldn&apos;t find any destinations for &ldquo;{currentQuery}&rdquo;. Try a city name, state, or famous landmark.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setPlaces([]);
                    setHasSearched(false);
                    setQuery('');
                    setCurrentQuery('');
                    setError(null);
                  }}
                  className="px-xl py-md bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-colors"
                >
                  Clear &amp; Try Again
                </button>
              </div>
            )}

            {/* ── Pexels Image Gallery (inside search section) ────── */}
            {galleryPlace && (
              <div ref={galleryRef} className="mt-xl">
                <div className="flex items-center justify-end mb-1">
                  <button
                    onClick={() => setGalleryPlace(null)}
                    className="flex items-center gap-1 text-xs text-[#8e6da0] hover:text-[#5e3670] transition-colors"
                    aria-label="Close photo gallery"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                    Close gallery
                  </button>
                </div>
                <PexelsGallery placeName={galleryPlace} count={80} />
              </div>
            )}
          </section>
        )}

        {/* 3 ── Popular Places (always visible, below search results) */}
        <PopularPlaces
          isLiked={isLiked}
          onToggleLike={toggleLike}
          onViewPhotos={handleViewPhotos}
        />

        {/* Gallery when triggered from Popular Places (no active search) */}
        {!hasSearched && galleryPlace && (
          <section className="max-w-container-max mx-auto px-margin-mobile md:px-lg pb-xl">
            <div ref={galleryRef} className="mt-xl">
              <div className="flex items-center justify-end mb-1">
                <button
                  onClick={() => setGalleryPlace(null)}
                  className="flex items-center gap-1 text-xs text-[#8e6da0] hover:text-[#5e3670] transition-colors"
                  aria-label="Close photo gallery"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                  Close gallery
                </button>
              </div>
              <PexelsGallery placeName={galleryPlace} count={80} />
            </div>
          </section>
        )}
      </>
    );
  };

  // Admin pages have their own full layout
  if (isAdminLoginPage) return <AdminLoginPage />;
  if (isAdminRoute) {
    return <AdminPage />;
  }

  return (
    <>
      <Drawer isOpen={isDrawerOpen} toggleDrawer={toggleDrawer} />
      <Header toggleDrawer={toggleDrawer} />

      <main>
        {renderPage()}
      </main>

      <Footer />
    </>
  );
}

export default App;
