import { useState, useEffect } from 'react';
import { getPackages } from '../services/api';
import BookingModal from '../components/BookingModal';

// Fallback images used when a package has no image_url or it fails to load
const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80',
  'https://images.unsplash.com/photo-1682687220945-922198770e60?w=800&q=80',
];

/**
 * Calculate duration string from travel_date and return_date.
 * e.g. "5 Days / 4 Nights"
 */
function getDuration(travel_date, return_date) {
  if (!travel_date || !return_date) return '';
  const start = new Date(travel_date);
  const end   = new Date(return_date);
  const days  = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  const nights = days - 1;
  return `${days} Days / ${nights} Nights`;
}

/**
 * Parse included_services from the package.
 * Convention: first entry that contains " · " is the places list.
 * All other entries are actual services.
 */
function parseServices(services) {
  if (!services || services.length === 0) return { places: '', tags: [] };
  const [first, ...rest] = services;
  if (first.includes(' · ') || first.includes(', ')) {
    return { places: first, tags: rest };
  }
  return { places: '', tags: services };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PackagesPage() {
  const [packages, setPackages]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [selectedPkg, setSelectedPkg] = useState(null);   // booking modal target
  const [detailPkg, setDetailPkg]   = useState(null);     // detail modal target

  useEffect(() => {
    getPackages()
      .then(setPackages)
      .catch(() => setError('Failed to load packages. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const isLoggedIn = !!localStorage.getItem('access_token');

  const handleBookClick = (pkg) => {
    if (!isLoggedIn) { window.location.href = '/login'; return; }
    setDetailPkg(null);   // close detail if open
    setSelectedPkg(pkg);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50">

      {/* ── Hero Banner ───────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-700 py-20 px-6">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }} />
        </div>
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white/90 px-4 py-1.5 rounded-full text-sm font-medium mb-4 backdrop-blur-sm">
            <span className="material-symbols-outlined text-[16px]">flight_takeoff</span>
            Departing from Rajkot
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Travel Packages
          </h1>
          <p className="text-purple-200 text-lg max-w-xl mx-auto">
            Explore our curated travel experiences. Book your dream getaway with full
            itinerary and services included.
          </p>
        </div>
      </div>

      {/* ── Package Grid ──────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-12">

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden animate-pulse">
                <div className="h-52 bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-9 bg-gray-200 rounded-xl mt-4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">😕</div>
            <p className="text-gray-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && packages.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">✈️</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No Packages Available</h2>
            <p className="text-gray-500">New travel packages will be listed here soon. Stay tuned!</p>
          </div>
        )}

        {/* Package cards */}
        {!loading && !error && packages.length > 0 && (
          <>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800">
                {packages.length} Package{packages.length !== 1 ? 's' : ''} Available
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {packages.map((pkg, idx) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  fallbackImage={FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length]}
                  onViewDetails={() => setDetailPkg(pkg)}
                  onBook={() => handleBookClick(pkg)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Detail Modal ──────────────────────────────────── */}
      {detailPkg && (
        <PackageDetailModal
          pkg={detailPkg}
          onClose={() => setDetailPkg(null)}
          onBook={() => handleBookClick(detailPkg)}
        />
      )}

      {/* ── Booking Modal ─────────────────────────────────── */}
      {selectedPkg && (
        <BookingModal
          pkg={selectedPkg}
          onClose={() => setSelectedPkg(null)}
          onSuccess={(booking) => {
            setTimeout(() => setSelectedPkg(null), 3000);
          }}
        />
      )}
    </div>
  );
}

// ─── Package Card ─────────────────────────────────────────────────────────────

function PackageCard({ pkg, fallbackImage, onViewDetails, onBook }) {
  const [imgSrc, setImgSrc] = useState(pkg.image_url || fallbackImage);
  const isSoldOut  = pkg.available_seats === 0;
  const duration   = getDuration(pkg.travel_date, pkg.return_date);
  const { places, tags } = parseServices(pkg.included_services || []);

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group border border-gray-100 flex flex-col">

      {/* ── Image ── */}
      <div className="relative h-52 overflow-hidden flex-shrink-0">
        <img
          src={imgSrc}
          alt={pkg.name}
          onError={() => setImgSrc(fallbackImage)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* State badge */}
        <div className="absolute top-3 left-3">
          <span className="bg-white/90 backdrop-blur-sm text-violet-700 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">map</span>
            {pkg.destination}
          </span>
        </div>

        {/* Sold-out overlay */}
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-red-600 text-white px-4 py-1.5 rounded-full font-bold text-sm">
              SOLD OUT
            </span>
          </div>
        )}

        {/* Price tag */}
        <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1">
          <span className="bg-violet-600 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg">
            ₹{pkg.price?.toLocaleString('en-IN')}
            <span className="font-normal text-xs opacity-80">/person</span>
          </span>
        </div>

        {/* Duration badge */}
        {duration && (
          <div className="absolute bottom-3 left-3">
            <span className="bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">schedule</span>
              {duration}
            </span>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="p-5 flex flex-col flex-1">

        {/* Name */}
        <h3 className="font-bold text-gray-800 text-lg mb-1 line-clamp-1">{pkg.name}</h3>

        {/* Places to visit */}
        {places && (
          <div className="flex items-start gap-1.5 mb-2">
            <span className="material-symbols-outlined text-violet-500 text-[14px] mt-0.5 flex-shrink-0">
              location_on
            </span>
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{places}</p>
          </div>
        )}

        {/* Description */}
        <p className="text-gray-500 text-sm line-clamp-2 mb-3">{pkg.description}</p>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-violet-400 text-[13px]">
              airline_seat_recline_normal
            </span>
            {pkg.available_seats} seats left
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-violet-400 text-[13px]">
              flight_takeoff
            </span>
            {pkg.origin}
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-violet-400 text-[13px]">
              calendar_today
            </span>
            {pkg.travel_date && new Date(pkg.travel_date).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </span>
        </div>

        {/* Service tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tags.slice(0, 3).map((s, i) => (
              <span
                key={i}
                className="bg-violet-50 text-violet-700 text-xs px-2 py-0.5 rounded-full border border-violet-100"
              >
                {s}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-xs text-gray-400 self-center">
                +{tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Spacer to push buttons to bottom */}
        <div className="flex-1" />

        {/* ── Action buttons ── */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={onViewDetails}
            className="flex-1 border border-violet-300 text-violet-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-violet-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">info</span>
            View Details
          </button>
          <button
            onClick={onBook}
            disabled={isSoldOut}
            className="flex-1 bg-gradient-to-r from-violet-600 to-purple-700 text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-violet-200 flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isSoldOut ? 'block' : 'flight_takeoff'}
            </span>
            {isSoldOut ? 'Sold Out' : 'Request Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Package Detail Modal ─────────────────────────────────────────────────────

function PackageDetailModal({ pkg, onClose, onBook }) {
  const [imgSrc, setImgSrc] = useState(
    pkg.image_url || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80'
  );
  const isSoldOut  = pkg.available_seats === 0;
  const duration   = getDuration(pkg.travel_date, pkg.return_date);
  const { places, tags } = parseServices(pkg.included_services || []);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">

        {/* ── Hero image header ── */}
        <div className="relative h-56 flex-shrink-0 overflow-hidden rounded-t-2xl">
          <img
            src={imgSrc}
            alt={pkg.name}
            onError={() =>
              setImgSrc(
                'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80'
              )
            }
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          {/* Overlay info */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
                {pkg.destination}
              </span>
              {duration && (
                <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">schedule</span>
                  {duration}
                </span>
              )}
            </div>
            <h2 className="text-white text-2xl font-extrabold leading-tight drop-shadow">
              {pkg.name}
            </h2>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-6 flex-1 space-y-5">

          {/* Price + Seats row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-extrabold text-violet-700">
                ₹{pkg.price?.toLocaleString('en-IN')}
                <span className="text-base font-normal text-gray-500 ml-1">/ person</span>
              </p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p className="font-semibold text-gray-700">{pkg.available_seats} / {pkg.total_seats}</p>
              <p>seats available</p>
            </div>
          </div>

          {/* Key details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: 'map', label: 'State', value: pkg.destination },
              { icon: 'schedule', label: 'Duration', value: duration || '—' },
              { icon: 'flight_takeoff', label: 'Departure', value: pkg.origin },
              {
                icon: 'calendar_today',
                label: 'Travel Date',
                value: pkg.travel_date
                  ? new Date(pkg.travel_date).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })
                  : '—',
              },
              {
                icon: 'event_available',
                label: 'Return Date',
                value: pkg.return_date
                  ? new Date(pkg.return_date).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })
                  : '—',
              },
              { icon: 'location_on', label: 'Pickup', value: pkg.pickup_location },
            ].map(({ icon, label, value }) => (
              <div
                key={label}
                className="bg-gray-50 rounded-xl p-3 flex flex-col gap-0.5"
              >
                <div className="flex items-center gap-1 text-violet-500 mb-0.5">
                  <span className="material-symbols-outlined text-[15px]">{icon}</span>
                  <span className="text-xs text-gray-500 font-medium">{label}</span>
                </div>
                <p className="text-sm font-semibold text-gray-800 leading-tight">{value}</p>
              </div>
            ))}
          </div>

          {/* Places to visit */}
          {places && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-violet-500 text-[18px]">
                  location_on
                </span>
                Places to Visit
              </h4>
              <div className="flex flex-wrap gap-2">
                {places.split(' · ').map((p, i) => (
                  <span
                    key={i}
                    className="bg-indigo-50 text-indigo-700 text-sm px-3 py-1 rounded-full border border-indigo-100 font-medium"
                  >
                    {p.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-violet-500 text-[18px]">
                description
              </span>
              About this Package
            </h4>
            <p className="text-gray-600 text-sm leading-relaxed">{pkg.description}</p>
          </div>

          {/* Included services */}
          {tags.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-violet-500 text-[18px]">
                  check_circle
                </span>
                What's Included
              </h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {tags.map((service, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[13px]">check</span>
                    </span>
                    {service}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ── Footer buttons ── */}
        <div className="px-6 pb-6 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={onBook}
            disabled={isSoldOut}
            className="flex-1 bg-gradient-to-r from-violet-600 to-purple-700 text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-violet-200 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">flight_takeoff</span>
            {isSoldOut ? 'Sold Out' : 'Request Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}


