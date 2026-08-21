import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : 'http://localhost:8000/api';

// ── Regular user API client (uses access_token from localStorage) ─────────────
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Admin panel API client (uses admin_token from localStorage) ───────────────
// This is COMPLETELY separate from user auth — requires the 6-digit code login
const adminApiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

adminApiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Intercept 401 on admin client → redirect to /admin-login
adminApiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      if (window.location.pathname.startsWith('/admin')) {
        window.location.href = '/admin-login';
      }
    }
    return Promise.reject(err);
  }
);

/**
 * Search for places using the backend /search-places endpoint.
 */
export const searchPlaces = async (query, limit = 8, offset = 0) => {
  const response = await apiClient.post('/search-places', { query, limit, offset });
  return response.data;
};

/**
 * Fetch real-time destination suggestions from backend API.
 */
export const getDestinationSuggestions = async (query, limit = 6) => {
  if (!query || !query.trim()) return [];
  const response = await apiClient.get('/destination-suggestions', {
    params: { q: query.trim(), limit },
  });
  return response.data;
};





/**
 * Fetch Pexels travel photos for a place name.
 */
export const fetchPlaceImages = async (placeName, count = 20) => {
  const encoded = encodeURIComponent(placeName);
  const response = await apiClient.get(`/images/${encoded}`, { params: { count } });
  return response.data;
};

/**
 * Fetch curated popular places on homepage load.
 */
export const getPopularPlaces = async () => {
  const response = await apiClient.get('/popular-places');
  return response.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin Auth (6-digit code)
// ─────────────────────────────────────────────────────────────────────────────

/** Admin: login with 6-digit code → receives admin_token */
export const adminLogin = async (code) => {
  // Use plain apiClient (no token needed for login)
  const res = await apiClient.post('/admin/auth/login', { code });
  return res.data;
};

/** Admin: verify the current admin_token is still valid */
export const adminVerifyToken = async () => {
  const res = await adminApiClient.get('/admin/auth/verify');
  return res.data;
};

/** Admin: change the 6-digit code */
export const adminChangeCode = async (newCode) => {
  const res = await adminApiClient.post('/admin/auth/change-code', { new_code: newCode });
  return res.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// Travel Packages (admin — uses adminApiClient)
// ─────────────────────────────────────────────────────────────────────────────

/** Public: list all ACTIVE packages */
export const getPackages = async () => {
  const res = await apiClient.get('/packages');
  return res.data;
};



/** Admin: list all packages (all statuses) */
export const adminGetPackages = async () => {
  const res = await adminApiClient.get('/admin/packages');
  return res.data;
};

/** Admin: create package */
export const adminCreatePackage = async (data) => {
  const res = await adminApiClient.post('/admin/packages', data);
  return res.data;
};

/** Admin: update package */
export const adminUpdatePackage = async (id, data) => {
  const res = await adminApiClient.put(`/admin/packages/${id}`, data);
  return res.data;
};

/** Admin: change package status */
export const adminUpdatePackageStatus = async (id, status) => {
  const res = await adminApiClient.patch(`/admin/packages/${id}/status`, { status });
  return res.data;
};

/** Admin: get all bookings for a specific package */
export const adminGetPackageBookings = async (packageId) => {
  const res = await adminApiClient.get(`/admin/packages/${packageId}/bookings`);
  return res.data;
};

/** Admin: dashboard stats (legacy) */
export const adminGetStats = async () => {
  const res = await adminApiClient.get('/admin/stats');
  return res.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// Bookings (admin — uses adminApiClient)
// ─────────────────────────────────────────────────────────────────────────────

/** User: create a booking request (Awaiting Admin Approval) */
export const createBooking = async (data) => {
  const res = await apiClient.post('/bookings', data);
  return res.data;
};

/** User: submit payment method for an APPROVED booking */
export const submitBookingPayment = async (bookingId, data) => {
  const res = await apiClient.post(`/bookings/${bookingId}/submit-payment`, data);
  return res.data;
};

/** User: get own bookings */
export const getMyBookings = async () => {
  const res = await apiClient.get('/bookings/my');
  return res.data;
};



/** Admin: all bookings with optional filters */
export const adminGetBookings = async (filters = {}) => {
  const res = await adminApiClient.get('/admin/bookings', { params: filters });
  return res.data;
};

/** Admin: approve booking request */
export const adminApproveBooking = async (id, note = '') => {
  const res = await adminApiClient.post(`/admin/bookings/${id}/approve`, { note });
  return res.data;
};

/** Admin: reject booking request */
export const adminRejectBooking = async (id, note = '') => {
  const res = await adminApiClient.post(`/admin/bookings/${id}/reject`, { note });
  return res.data;
};

/** Admin: confirm payment */
export const adminConfirmPayment = async (id, note = '') => {
  const res = await adminApiClient.post(`/admin/bookings/${id}/confirm-payment`, { note });
  return res.data;
};

/** Admin: reject payment */
export const adminRejectPayment = async (id, note = '') => {
  const res = await adminApiClient.post(`/admin/bookings/${id}/reject-payment`, { note });
  return res.data;
};

/** Admin: cancel booking */
export const adminCancelBooking = async (id, note = '') => {
  const res = await adminApiClient.post(`/admin/bookings/${id}/cancel`, { note });
  return res.data;
};

/** Admin: reset expired/cancelled booking */
export const adminResetBooking = async (id) => {
  const res = await adminApiClient.post(`/admin/bookings/${id}/reset`);
  return res.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// UPI Settings
// ─────────────────────────────────────────────────────────────────────────────

/** Public: get UPI settings */
export const getUpiSettings = async () => {
  const res = await apiClient.get('/settings/upi');
  return res.data;
};

/** Admin: update UPI settings (text fields) */
export const adminUpdateUpiSettings = async (data) => {
  const res = await adminApiClient.put('/admin/settings/upi', data);
  return res.data;
};

/** Admin: upload UPI QR scanner image file (PNG, JPG, JPEG) */
export const adminUploadUpiQr = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await adminApiClient.post('/admin/settings/upi/upload-qr', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

/** User: get own profile details */
export const getProfile = async () => {
  const res = await apiClient.get('/auth/me');
  return res.data;
};

/** User: update own profile (full_name, mobile) */
export const updateProfile = async (data) => {
  const res = await apiClient.patch('/auth/me', data);
  return res.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// Activity Log & Enhanced Stats (admin — uses adminApiClient)
// ─────────────────────────────────────────────────────────────────────────────

/** Admin: get paginated activity log */
export const getActivityLog = async (filters = {}) => {
  const res = await adminApiClient.get('/admin/activity', { params: filters });
  return res.data;
};

/** Admin: get enhanced stats (users, revenue, searches) */
export const getEnhancedStats = async () => {
  const res = await adminApiClient.get('/admin/activity/stats');
  return res.data;
};

/** Admin: get all registered users */
export const adminGetUsers = async () => {
  const res = await adminApiClient.get('/admin/users');
  return res.data;
};

export { adminApiClient };
export default apiClient;
