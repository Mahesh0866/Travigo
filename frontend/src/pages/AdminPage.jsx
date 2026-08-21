import { useState, useEffect, useCallback } from 'react';
import {
  getEnhancedStats,
  adminGetPackages,
  adminCreatePackage,
  adminUpdatePackage,
  adminUpdatePackageStatus,
  adminGetPackageBookings,
  adminGetBookings,
  adminApproveBooking,
  adminRejectBooking,
  adminConfirmPayment,
  adminRejectPayment,
  adminCancelBooking,
  adminResetBooking,
  getUpiSettings,
  adminUpdateUpiSettings,
  adminUploadUpiQr,
  getActivityLog,
  adminGetUsers,
  adminVerifyToken,
  adminChangeCode,
} from '../services/api';
import StatusBadge from '../components/StatusBadge';
import PaymentDeadlineTimer from '../components/PaymentDeadlineTimer';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'activity', label: 'Activity Log', icon: 'history' },
  { id: 'packages', label: 'Packages', icon: 'luggage' },
  { id: 'bookings', label: 'Bookings', icon: 'receipt_long' },
  { id: 'users', label: 'Users', icon: 'group' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export default function AdminPage() {
  const [tab, setTab] = useState('dashboard');
  const [authChecked, setAuthChecked] = useState(false);

  // Use admin_token (from 6-digit code login), NOT access_token
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      window.location.href = '/admin-login';
      return;
    }
    // Verify the token is still valid
    adminVerifyToken()
      .then(() => setAuthChecked(true))
      .catch(() => {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin-login';
      });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    window.location.href = '/admin-login';
  };

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(126,87,194,0.3)', borderTopColor: '#7e57c2', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p>Verifying admin session...</p>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-violet-400 text-[28px]">admin_panel_settings</span>
            <div>
              <h1 className="text-xl font-bold">Admin Panel</h1>
              <p className="text-slate-400 text-xs">Travigo Travel Officer Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-slate-300 hover:text-white text-sm flex items-center gap-1 transition-colors">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to Site
            </a>
            <button
              onClick={handleLogout}
              className="text-slate-300 hover:text-red-400 text-sm flex items-center gap-1 transition-colors border border-slate-600 hover:border-red-500 px-3 py-1.5 rounded-lg"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
                tab === t.id
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'activity' && <ActivityTab />}
        {tab === 'packages' && <PackagesTab />}
        {tab === 'bookings' && <BookingsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

function DashboardTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEnhancedStats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  const COLOR_MAP = {
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    teal: 'bg-teal-50 text-teal-700 border-teal-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    green: 'bg-green-50 text-green-700 border-green-100',
  };

  const cards = stats ? [
    // Users
    { label: 'Total Users', value: stats.total_users, icon: 'group', color: 'blue' },
    { label: 'Total Logins', value: stats.total_logins, icon: 'login', color: 'teal' },
    { label: 'Total Searches', value: stats.total_searches, icon: 'search', color: 'purple' },
    { label: 'Package Views', value: stats.package_views, icon: 'visibility', color: 'violet' },
    // Packages
    { label: 'Active Packages', value: stats.active_packages, icon: 'check_circle', color: 'emerald' },
    { label: 'Available Seats', value: stats.available_seats, icon: 'airline_seat_recline_normal', color: 'green' },
    // Bookings
    { label: 'Total Bookings', value: stats.total_bookings, icon: 'receipt_long', color: 'blue' },
    { label: 'Confirmed', value: stats.confirmed_bookings, icon: 'task_alt', color: 'emerald' },
    { label: 'Pending Payment', value: stats.pending_payments, icon: 'pending_actions', color: 'amber' },
    { label: 'Expired', value: stats.expired_bookings, icon: 'timer_off', color: 'gray' },
    { label: 'Cancelled', value: stats.cancelled_bookings, icon: 'cancel', color: 'red' },
    // Revenue
    { label: 'Total Revenue', value: `₹${(stats.total_revenue || 0).toLocaleString()}`, icon: 'currency_rupee', color: 'orange' },
    { label: 'Cash Bookings', value: stats.cash_bookings, icon: 'payments', color: 'amber' },
    { label: 'UPI Bookings', value: stats.upi_bookings, icon: 'qr_code', color: 'violet' },
    { label: 'Total Travelers', value: stats.total_travelers, icon: 'person_pin', color: 'teal' },
    { label: 'Total Packages', value: stats.total_packages, icon: 'luggage', color: 'purple' },
  ] : [];

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard Overview</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-2xl border p-5 ${COLOR_MAP[card.color]}`}>
            <span className="material-symbols-outlined text-[28px] mb-2 block">{card.icon}</span>
            <p className="text-3xl font-extrabold">{card.value}</p>
            <p className="text-sm font-medium mt-1 opacity-80">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Activity Log Tab ─────────────────────────────────────────────────────────

const ACTION_META = {
  USER_REGISTERED:          { icon: 'person_add', color: 'text-blue-600', bg: 'bg-blue-50', label: 'User Registered' },
  USER_LOGIN:               { icon: 'login', color: 'text-teal-600', bg: 'bg-teal-50', label: 'User Login' },
  USER_SEARCH:              { icon: 'search', color: 'text-purple-600', bg: 'bg-purple-50', label: 'Search' },
  USER_VIEW_PACKAGE:        { icon: 'visibility', color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Package View' },
  USER_BOOKED:              { icon: 'flight_takeoff', color: 'text-violet-600', bg: 'bg-violet-50', label: 'Booking Created' },
  USER_CANCELLED_BOOKING:   { icon: 'cancel', color: 'text-red-500', bg: 'bg-red-50', label: 'User Cancelled' },
  PAYMENT_METHOD_SELECTED:  { icon: 'payments', color: 'text-amber-600', bg: 'bg-amber-50', label: 'Payment Method' },
  PAYMENT_SUBMITTED:        { icon: 'send', color: 'text-green-600', bg: 'bg-green-50', label: 'Payment Submitted' },
  PAYMENT_DEADLINE_EXPIRED: { icon: 'timer_off', color: 'text-orange-500', bg: 'bg-orange-50', label: 'Deadline Expired' },
  ADMIN_CONFIRMED_PAYMENT:  { icon: 'check_circle', color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Payment Confirmed' },
  ADMIN_REJECTED_PAYMENT:   { icon: 'cancel', color: 'text-red-600', bg: 'bg-red-50', label: 'Payment Rejected' },
  ADMIN_CANCELLED_BOOKING:  { icon: 'block', color: 'text-red-500', bg: 'bg-red-50', label: 'Admin Cancelled' },
  ADMIN_RESET_BOOKING:      { icon: 'restart_alt', color: 'text-violet-600', bg: 'bg-violet-50', label: 'Admin Reset' },
  ADMIN_CREATED_PACKAGE:    { icon: 'add_box', color: 'text-blue-600', bg: 'bg-blue-50', label: 'Package Created' },
  ADMIN_UPDATED_PACKAGE:    { icon: 'edit', color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Package Updated' },
  ADMIN_CHANGED_PKG_STATUS: { icon: 'toggle_on', color: 'text-amber-600', bg: 'bg-amber-50', label: 'Status Changed' },
  ADMIN_UPDATED_UPI:        { icon: 'qr_code', color: 'text-teal-600', bg: 'bg-teal-50', label: 'UPI Updated' },
  ADMIN_CHANGED_CODE:       { icon: 'lock_reset', color: 'text-purple-600', bg: 'bg-purple-50', label: 'Code Changed' },
  SYSTEM_BOOKING_EXPIRED:   { icon: 'schedule', color: 'text-gray-500', bg: 'bg-gray-100', label: 'System Expired' },
};

function ActivityTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (actionFilter) params.action = actionFilter;
    if (actorFilter) params.actor_type = actorFilter;
    params.limit = 200;
    getActivityLog(params)
      .then(d => setLogs(d.logs || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [actionFilter, actorFilter]);

  useEffect(() => { load(); }, [load]);

  const fmt = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Activity Log ({logs.length})</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
          >
            <option value="">All Actions</option>
            {Object.entries(ACTION_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select
            value={actorFilter}
            onChange={e => setActorFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
          >
            <option value="">All Actors</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="system">System</option>
          </select>
          <button onClick={load} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
            <span className="material-symbols-outlined text-gray-600 text-[18px]">refresh</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <span className="material-symbols-outlined text-[48px] mb-3 block">history</span>
          No activity logs yet.
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const meta = ACTION_META[log.action] || { icon: 'info', color: 'text-gray-500', bg: 'bg-gray-50', label: log.action };
            return (
              <div key={log.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-3 flex items-start gap-4 hover:shadow-sm transition-shadow">
                {/* Icon */}
                <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <span className={`material-symbols-outlined text-[18px] ${meta.color}`}>{meta.icon}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>{meta.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      log.actor_type === 'admin' ? 'bg-violet-50 text-violet-600' :
                      log.actor_type === 'system' ? 'bg-gray-100 text-gray-500' :
                      'bg-blue-50 text-blue-600'
                    }`}>{log.actor_type}</span>
                    {log.user_id && <span className="text-xs text-gray-400">User #{log.user_id}</span>}
                  </div>
                  <p className="text-sm text-gray-700 mt-1 font-medium">{log.detail}</p>
                  {log.metadata && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      {Object.entries(log.metadata).filter(([,v]) => v != null && v !== '').slice(0, 4).map(([k, v]) => (
                        <span key={k} className="text-xs text-gray-400">
                          <span className="text-gray-500 font-medium">{k}:</span> {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <div className="text-xs text-gray-400 flex-shrink-0 text-right">
                  {fmt(log.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Packages Tab ─────────────────────────────────────────────────────────────

const EMPTY_PKG_FORM = {
  name: '', description: '', origin: 'Rajkot', destination: '',
  travel_date: '', return_date: '', price: '', pickup_location: '',
  total_seats: '', included_services: '', image_url: '',
};

function PackagesTab() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPkg, setEditPkg] = useState(null);
  const [form, setForm] = useState(EMPTY_PKG_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [bookingsModal, setBookingsModal] = useState(null); // { pkg, data }
  const [bookingsLoading, setBookingsLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminGetPackages().then(setPackages).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditPkg(null); setForm(EMPTY_PKG_FORM); setError(''); setShowForm(true); };
  const openEdit = (pkg) => {
    setEditPkg(pkg);
    setForm({
      name: pkg.name, description: pkg.description, origin: pkg.origin,
      destination: pkg.destination, travel_date: pkg.travel_date, return_date: pkg.return_date,
      price: pkg.price, pickup_location: pkg.pickup_location, total_seats: pkg.total_seats,
      included_services: (pkg.included_services || []).join(', '), image_url: pkg.image_url || '',
    });
    setError(''); setShowForm(true);
  };

  const openBookings = async (pkg) => {
    setBookingsLoading(true);
    setBookingsModal({ pkg, data: null });
    try {
      const data = await adminGetPackageBookings(pkg.id);
      setBookingsModal({ pkg, data });
    } catch (e) {
      setBookingsModal(null);
      alert('Failed to load bookings: ' + (e.response?.data?.detail || e.message));
    } finally {
      setBookingsLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSave = async () => {
    if (!form.name || !form.destination || !form.travel_date || !form.return_date || !form.price || !form.total_seats || !form.pickup_location) {
      setError('Please fill all required fields.'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        total_seats: parseInt(form.total_seats),
        included_services: form.included_services.split(',').map(s => s.trim()).filter(Boolean),
      };
      if (editPkg) {
        await adminUpdatePackage(editPkg.id, payload);
        setSuccess('Package updated!');
      } else {
        await adminCreatePackage(payload);
        setSuccess('Package created!');
      }
      setShowForm(false); load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save package.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id, newStatus) => {
    try { await adminUpdatePackageStatus(id, newStatus); load(); }
    catch (e) { alert(e.response?.data?.detail || 'Failed to update status.'); }
  };

  const STATUS_ACTIONS = {
    ACTIVE: [
      { label: 'Deactivate', status: 'INACTIVE', color: 'amber' },
      { label: 'Cancel', status: 'CANCELLED', color: 'red' },
    ],
    INACTIVE: [
      { label: 'Activate', status: 'ACTIVE', color: 'emerald' },
      { label: 'Cancel', status: 'CANCELLED', color: 'red' },
    ],
    CANCELLED: [
      { label: 'Restore (Active)', status: 'ACTIVE', color: 'emerald' },
    ],
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Packages ({packages.length})</h2>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Package
        </button>
      </div>

      {success && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm">✅ {success}</div>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-4">
          {packages.length === 0 && (
            <div className="text-center py-16 text-gray-500">No packages yet. Create one!</div>
          )}
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono text-gray-400">#{pkg.id}</span>
                    <StatusBadge status={pkg.status} />
                  </div>
                  <h3 className="font-bold text-gray-800 truncate">{pkg.name}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-1 flex-wrap">
                    <span>✈️ {pkg.origin} → {pkg.destination}</span>
                    <span>📅 {pkg.travel_date}</span>
                    <span>₹{pkg.price?.toLocaleString()}/person</span>
                    <span>🪑 {pkg.available_seats}/{pkg.total_seats} seats</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <button
                    onClick={() => openBookings(pkg)}
                    className="px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-sm font-medium hover:bg-violet-100 transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                    Bookings
                  </button>
                  <button
                    onClick={() => openEdit(pkg)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">edit</span>
                    Edit
                  </button>
                  {(STATUS_ACTIONS[pkg.status] || []).map((action) => (
                    <button
                      key={action.status}
                      onClick={() => changeStatus(pkg.id, action.status)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        action.color === 'emerald' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' :
                        action.color === 'amber' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' :
                        'bg-red-50 text-red-700 hover:bg-red-100'
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Package Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-5 text-white flex justify-between items-center sticky top-0 z-10">
              <h3 className="font-bold text-lg">{editPkg ? 'Edit Package' : 'New Travel Package'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-full hover:bg-white/20">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Package Name *" name="name" value={form.name} onChange={handleFormChange} placeholder="e.g. Goa Beach Special" />
                <FormField label="Destination *" name="destination" value={form.destination} onChange={handleFormChange} placeholder="e.g. Goa" />
                <FormField label="Origin" name="origin" value={form.origin} onChange={handleFormChange} placeholder="Rajkot" />
                <FormField label="Pickup Location *" name="pickup_location" value={form.pickup_location} onChange={handleFormChange} placeholder="e.g. Rajkot Railway Station" />
                <FormField label="Travel Date *" name="travel_date" type="date" value={form.travel_date} onChange={handleFormChange} />
                <FormField label="Return Date *" name="return_date" type="date" value={form.return_date} onChange={handleFormChange} />
                <FormField label="Price per Person (₹) *" name="price" type="number" value={form.price} onChange={handleFormChange} placeholder="e.g. 5999" />
                <FormField label="Total Seats *" name="total_seats" type="number" value={form.total_seats} onChange={handleFormChange} placeholder="e.g. 40" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea name="description" value={form.description} onChange={handleFormChange} rows={3}
                  placeholder="Describe the package..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50" />
              </div>
              <FormField label="Included Services (comma-separated)" name="included_services" value={form.included_services} onChange={handleFormChange} placeholder="e.g. Breakfast, AC Bus, Hotel, Sightseeing" />
              <FormField label="Package Image URL (optional)" name="image_url" value={form.image_url} onChange={handleFormChange} placeholder="https://..." />
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                {saving ? <><Spinner />Saving...</> : (editPkg ? '💾 Save Changes' : '✅ Create Package')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Package Bookings Modal */}
      {bookingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setBookingsModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">Bookings — {bookingsModal.pkg.name}</h3>
                <p className="text-violet-200 text-xs mt-0.5">{bookingsModal.pkg.origin} → {bookingsModal.pkg.destination}</p>
              </div>
              <button onClick={() => setBookingsModal(null)} className="p-1.5 rounded-full hover:bg-white/20">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {bookingsLoading ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : bookingsModal.data ? (
                <>
                  {/* Summary */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
                    {[
                      { label: 'Total', value: bookingsModal.data.summary.total, color: 'blue' },
                      { label: 'Confirmed', value: bookingsModal.data.summary.confirmed, color: 'emerald' },
                      { label: 'Pending', value: bookingsModal.data.summary.pending, color: 'amber' },
                      { label: 'Cancelled', value: bookingsModal.data.summary.cancelled, color: 'red' },
                      { label: 'Expired', value: bookingsModal.data.summary.expired, color: 'gray' },
                      { label: '₹ Revenue', value: `₹${bookingsModal.data.summary.total_revenue?.toLocaleString()}`, color: 'violet' },
                    ].map(s => (
                      <div key={s.label} className={`rounded-xl p-3 text-center ${
                        s.color === 'blue' ? 'bg-blue-50 text-blue-700' :
                        s.color === 'emerald' ? 'bg-emerald-50 text-emerald-700' :
                        s.color === 'amber' ? 'bg-amber-50 text-amber-700' :
                        s.color === 'red' ? 'bg-red-50 text-red-700' :
                        s.color === 'violet' ? 'bg-violet-50 text-violet-700' :
                        'bg-gray-50 text-gray-600'
                      }`}>
                        <p className="text-xl font-bold">{s.value}</p>
                        <p className="text-xs mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Booking rows */}
                  {bookingsModal.data.bookings.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">No bookings yet for this package.</p>
                  ) : (
                    <div className="space-y-3">
                      {bookingsModal.data.bookings.map(b => (
                        <div key={b.id} className="border border-gray-100 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-xs font-mono text-gray-400">#{b.id}</span>
                            <StatusBadge status={b.status} />
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{b.payment_method}</span>
                          </div>
                          <p className="font-semibold text-gray-800">{b.traveler_name}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                            <span>📞 {b.traveler_mobile}</span>
                            <span>✉️ {b.traveler_email}</span>
                            <span>👤 {b.num_travelers} traveler{b.num_travelers > 1 ? 's' : ''}</span>
                            <span>💰 ₹{b.total_amount?.toLocaleString()}</span>
                            <span>📅 Travel: {b.travel_date}</span>
                          </div>
                          {b.upi_transaction_id && (
                            <p className="text-xs text-blue-600 mt-1">UPI: <code className="bg-blue-50 px-1 rounded">{b.upi_transaction_id}</code></p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────

function BookingsTab() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [noteInput, setNoteInput] = useState({});
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    adminGetBookings(statusFilter ? { status: statusFilter } : {})
      .then(setBookings).catch(console.error).finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const doAction = async (action, id, note = '') => {
    setActionLoading(`${action}-${id}`);
    try {
      if (action === 'approve') await adminApproveBooking(id, note);
      else if (action === 'reject-request') await adminRejectBooking(id, note);
      else if (action === 'confirm') await adminConfirmPayment(id, note);
      else if (action === 'reject') await adminRejectPayment(id, note);
      else if (action === 'cancel') await adminCancelBooking(id, note);
      else if (action === 'reset') await adminResetBooking(id);
      showMsg('Action completed!');
      load();
    } catch (e) {
      showMsg('Error: ' + (e.response?.data?.detail || 'Action failed'));
    } finally {
      setActionLoading(null);
    }
  };

  const STATUSES = ['', 'PENDING_ADMIN_APPROVAL', 'APPROVED', 'PENDING_PAYMENT', 'PAYMENT_VERIFICATION', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'EXPIRED'];

  const pendingRequests = bookings.filter(b => b.status === 'PENDING_ADMIN_APPROVAL');

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Bookings ({bookings.length})</h2>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
          >
            <option value="">All Statuses</option>
            {STATUSES.slice(1).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <button onClick={load} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
            <span className="material-symbols-outlined text-gray-600 text-[18px]">refresh</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
          msg.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>{msg}</div>
      )}

      {/* Prominent Pending Requests Alert Banner if any exist and filter is not hiding them */}
      {(!statusFilter || statusFilter === 'PENDING_ADMIN_APPROVAL') && pendingRequests.length > 0 && (
        <div className="mb-6 bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-purple-600 text-[26px]">notifications_active</span>
            <div>
              <p className="font-bold text-purple-900 text-sm">{pendingRequests.length} Booking Request(s) Awaiting Approval</p>
              <p className="text-xs text-purple-700">Review request details and click Approve or Reject below.</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No bookings found.</div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <div key={b.id} className={`bg-white rounded-2xl border shadow-sm transition-all ${
              b.status === 'PENDING_ADMIN_APPROVAL' ? 'border-purple-300 ring-2 ring-purple-50' :
              b.status === 'PAYMENT_VERIFICATION' ? 'border-blue-400 ring-2 ring-blue-50' :
              'border-gray-100'
            }`}>
              {/* ── PAYMENT VERIFICATION prominent banner ── */}
              {b.status === 'PAYMENT_VERIFICATION' && (
                <div className="bg-blue-600 px-5 py-3 flex items-center gap-2 rounded-t-2xl">
                  <span className="material-symbols-outlined text-white text-[20px]">manage_search</span>
                  <p className="text-white font-bold text-sm">UPI Payment Verification Required</p>
                  <span className="ml-auto text-xs text-blue-100 bg-blue-500 px-2 py-0.5 rounded-full">Action Needed</span>
                </div>
              )}

              <div className="p-5">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Left info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-mono text-xs text-gray-400">#{b.id}</span>
                      <StatusBadge status={b.status} />
                      {b.payment_method && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          b.payment_method === 'UPI' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {b.payment_method === 'CASH' ? '💵 Cash' : '📱 UPI'}
                        </span>
                      )}
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Pkg #{b.package_id}</span>
                    </div>
                    <p className="font-semibold text-gray-800">{b.traveler_name}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                      <span>👤 {b.num_travelers} traveler{b.num_travelers > 1 ? 's' : ''}</span>
                      <span>💰 ₹{b.total_amount?.toLocaleString()}</span>
                      <span>📞 {b.traveler_mobile}</span>
                      <span>✉️ {b.traveler_email}</span>
                      <span>📅 Travel: {b.travel_date}</span>
                      <span>🕒 Requested: {b.created_at && new Date(b.created_at).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                    </div>

                    {/* UPI Transaction ID — highlighted for PAYMENT_VERIFICATION */}
                    {b.upi_transaction_id && (
                      <div className={`mt-3 rounded-xl px-4 py-3 flex items-center gap-3 ${
                        b.status === 'PAYMENT_VERIFICATION' ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'
                      }`}>
                        <span className="material-symbols-outlined text-blue-500 text-[20px] flex-shrink-0">receipt</span>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">UPI Transaction ID</p>
                          <code className={`font-mono font-bold text-sm ${
                            b.status === 'PAYMENT_VERIFICATION' ? 'text-blue-800' : 'text-gray-700'
                          }`}>{b.upi_transaction_id}</code>
                        </div>
                      </div>
                    )}

                    {b.status === 'PENDING_PAYMENT' && b.payment_deadline && (
                      <div className="mt-2"><PaymentDeadlineTimer deadline={b.payment_deadline} /></div>
                    )}
                    {b.admin_note && <p className="text-xs text-gray-500 mt-2 italic bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">📝 {b.admin_note}</p>}
                  </div>

                  {/* Right: actions */}
                  <div className="flex flex-col gap-2 min-w-[230px]">
                    {/* Note input */}
                    {['PENDING_ADMIN_APPROVAL', 'PENDING_PAYMENT', 'PAYMENT_VERIFICATION'].includes(b.status) && (
                      <input type="text" placeholder="Admin note / Reason (optional)"
                        value={noteInput[b.id] || ''}
                        onChange={e => setNoteInput(n => ({ ...n, [b.id]: e.target.value }))}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300 bg-gray-50" />
                    )}

                    {/* APPROVE & REJECT request */}
                    {b.status === 'PENDING_ADMIN_APPROVAL' && (
                      <div className="flex gap-2">
                        <button onClick={() => doAction('approve', b.id, noteInput[b.id])}
                          disabled={actionLoading === `approve-${b.id}`}
                          className="flex-1 px-3 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
                          {actionLoading === `approve-${b.id}` ? <Spinner /> : <><span className="material-symbols-outlined text-[15px]">thumb_up</span>APPROVE</>}
                        </button>
                        <button onClick={() => doAction('reject-request', b.id, noteInput[b.id])}
                          disabled={actionLoading === `reject-request-${b.id}`}
                          className="flex-1 px-3 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
                          {actionLoading === `reject-request-${b.id}` ? <Spinner color="red" /> : <><span className="material-symbols-outlined text-[15px]">thumb_down</span>REJECT</>}
                        </button>
                      </div>
                    )}

                    {/* CONFIRM PAYMENT (both cash & upi) */}
                    {(b.status === 'PENDING_PAYMENT' || b.status === 'PAYMENT_VERIFICATION') && (
                      <button onClick={() => doAction('confirm', b.id, noteInput[b.id])}
                        disabled={actionLoading === `confirm-${b.id}`}
                        className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm">
                        {actionLoading === `confirm-${b.id}` ? <Spinner /> : <><span className="material-symbols-outlined text-[16px]">check_circle</span>✅ Confirm Payment</>}
                      </button>
                    )}

                    {/* REJECT UPI payment */}
                    {b.status === 'PAYMENT_VERIFICATION' && (
                      <button onClick={() => doAction('reject', b.id, noteInput[b.id])}
                        disabled={actionLoading === `reject-${b.id}`}
                        className="px-4 py-2.5 bg-red-50 text-red-700 border-2 border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                        {actionLoading === `reject-${b.id}` ? <Spinner color="red" /> : <><span className="material-symbols-outlined text-[16px]">cancel</span>❌ Reject UPI Payment</>}
                      </button>
                    )}

                    {/* CANCEL */}
                    {!['CANCELLED', 'EXPIRED', 'REJECTED', 'CONFIRMED'].includes(b.status) && b.status !== 'PENDING_ADMIN_APPROVAL' && (
                      <button onClick={() => doAction('cancel', b.id, noteInput[b.id])}
                        disabled={actionLoading === `cancel-${b.id}`}
                        className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
                        {actionLoading === `cancel-${b.id}` ? <Spinner color="gray" /> : <><span className="material-symbols-outlined text-[14px]">block</span>Cancel Booking</>}
                      </button>
                    )}

                    {/* RESET */}
                    {['CANCELLED', 'EXPIRED', 'REJECTED'].includes(b.status) && (
                      <button onClick={() => doAction('reset', b.id)}
                        disabled={actionLoading === `reset-${b.id}`}
                        className="px-4 py-2 bg-violet-50 text-violet-700 border border-violet-200 rounded-xl text-xs font-semibold hover:bg-violet-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
                        {actionLoading === `reset-${b.id}` ? <Spinner color="violet" /> : <><span className="material-symbols-outlined text-[14px]">restart_alt</span>Reset (5-hr window)</>}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminGetUsers().then(setUsers).catch(console.error).finally(() => setLoading(false));
  }, []);

  const fmt = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true }) : '—';

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Registered Users ({users.length})</h2>
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No users registered yet.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs">#</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs">Mobile</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs">Registered</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">#{u.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{u.full_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600">{u.mobile || '—'}</td>
                  <td className="px-4 py-3">
                    {u.is_admin
                      ? <span className="bg-violet-100 text-violet-700 text-xs font-semibold px-2 py-0.5 rounded-full">Admin</span>
                      : <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">User</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmt(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const [upi, setUpi] = useState({ upi_id: '', qr_image_base64: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // File upload state for QR scanner
  const [qrFile, setQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState(null);
  const [uploadingQr, setUploadingQr] = useState(false);

  // Change code state
  const [newCode, setNewCode] = useState('');
  const [changingCode, setChangingCode] = useState(false);
  const [codeMsg, setCodeMsg] = useState('');

  useEffect(() => {
    getUpiSettings().then(s => {
      setUpi({ upi_id: s.upi_id || '', qr_image_base64: s.qr_image_base64 || '' });
    }).finally(() => setLoading(false));
  }, []);

  const handleSaveUpi = async () => {
    setSaving(true);
    try {
      await adminUpdateUpiSettings(upi);
      setMsg('✅ UPI settings saved!');
    } catch (e) {
      setMsg('❌ Failed to save: ' + (e.response?.data?.detail || ''));
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowed = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!allowed.includes(file.type) && !/\.(png|jpg|jpeg)$/i.test(file.name)) {
        setMsg('❌ Please select a PNG, JPG, or JPEG file.');
        return;
      }
      setQrFile(file);
      setQrPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadQrFile = async () => {
    if (!qrFile) {
      setMsg('❌ Please select an image file first.');
      return;
    }
    setUploadingQr(true);
    setMsg('');
    try {
      const res = await adminUploadUpiQr(qrFile);
      setUpi(u => ({ ...u, qr_image_base64: res.qr_image_base64 }));
      setQrFile(null);
      setQrPreview(null);
      setMsg('✅ UPI QR Scanner image uploaded and saved successfully!');
    } catch (e) {
      setMsg('❌ Upload failed: ' + (e.response?.data?.detail || 'Error uploading scanner image'));
    } finally {
      setUploadingQr(false);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const handleChangeCode = async () => {
    if (!/^\d{6}$/.test(newCode)) {
      setCodeMsg('❌ Code must be exactly 6 numeric digits.');
      return;
    }
    setChangingCode(true);
    try {
      await adminChangeCode(newCode);
      setCodeMsg('✅ Admin code changed! You will be logged out.');
      setNewCode('');
      setTimeout(() => {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin-login';
      }, 2000);
    } catch (e) {
      setCodeMsg('❌ ' + (e.response?.data?.detail || 'Failed to change code.'));
    } finally {
      setChangingCode(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Settings</h2>

      {/* UPI Settings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-violet-600 text-[24px]">qr_code_2</span>
          <h3 className="text-lg font-semibold text-gray-800">UPI Payment & QR Scanner</h3>
        </div>

        {msg && (
          <div className={`px-4 py-3 rounded-xl text-sm font-medium ${msg.startsWith('❌') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>{msg}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID</label>
          <input type="text" value={upi.upi_id}
            onChange={e => setUpi(u => ({ ...u, upi_id: e.target.value }))}
            placeholder="e.g. travigo@upi or 9876543210@paytm"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50" />
          <p className="text-xs text-gray-400 mt-1">This UPI ID will be shown to users during payment.</p>
        </div>

        {/* Upload QR Scanner File Section */}
        <div className="border border-violet-100 bg-violet-50/50 rounded-xl p-4 space-y-3">
          <label className="block text-sm font-semibold text-gray-800">
            Upload New UPI QR Scanner Image (PNG, JPG, JPEG)
          </label>
          <input
            type="file"
            accept="image/png, image/jpeg, image/jpg"
            onChange={handleFileChange}
            className="block w-full text-xs text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-violet-600 file:text-white hover:file:bg-violet-700 cursor-pointer"
          />
          {qrPreview && (
            <div className="mt-2 flex items-center gap-4 bg-white p-3 rounded-xl border border-violet-200">
              <img src={qrPreview} alt="New QR Preview" className="w-24 h-24 object-contain rounded border" />
              <div>
                <p className="text-xs font-semibold text-gray-800">Selected file: {qrFile?.name}</p>
                <p className="text-[11px] text-gray-500">{(qrFile?.size / 1024).toFixed(1)} KB</p>
                <button
                  onClick={handleUploadQrFile}
                  disabled={uploadingQr}
                  className="mt-2 px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50 flex items-center gap-1"
                >
                  {uploadingQr ? 'Uploading...' : '📤 Upload & Save QR Image'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Current UPI QR Image Base64 Data URL (Read-only Preview)</label>
          <input type="text" value={upi.qr_image_base64}
            readOnly
            placeholder="data:image/png;base64,... or auto-filled upon upload"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50 font-mono text-xs" />
        </div>

        {upi.qr_image_base64 && (
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-xs text-gray-500 mb-2 font-medium">Active QR Scanner Preview (shown to users):</p>
            <img src={upi.qr_image_base64} alt="UPI QR Preview"
              className="w-36 h-36 object-contain rounded-lg border bg-white p-2"
              onError={e => { e.target.style.display = 'none'; }} />
          </div>
        )}

        <button onClick={handleSaveUpi} disabled={saving}
          className="w-full bg-gradient-to-r from-violet-600 to-purple-700 text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity">
          {saving ? <><Spinner /> Saving...</> : '💾 Save UPI Settings'}
        </button>
      </div>

      {/* Change Admin Code */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-red-500 text-[24px]">lock_reset</span>
          <h3 className="text-lg font-semibold text-gray-800">Change Admin Code</h3>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          ⚠️ After changing the code, you will be automatically logged out and must log in again with the new 6-digit code.
        </div>

        {codeMsg && (
          <div className={`px-4 py-3 rounded-xl text-sm font-medium ${codeMsg.startsWith('❌') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>{codeMsg}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New 6-Digit Code</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={newCode}
            onChange={e => setNewCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Enter new 6-digit numeric code"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-gray-50 tracking-widest"
          />
          <p className="text-xs text-gray-400 mt-1">Must be exactly 6 numeric digits (e.g. 847291).</p>
        </div>

        <button onClick={handleChangeCode} disabled={changingCode || newCode.length !== 6}
          className="w-full bg-gradient-to-r from-red-500 to-rose-600 text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity">
          {changingCode ? <><Spinner /> Changing...</> : '🔐 Change Admin Code'}
        </button>
      </div>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function FormField({ label, name, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50" />
    </div>
  );
}

function Spinner({ color = 'white' }) {
  const cls = color === 'white' ? 'border-white/30 border-t-white' :
    color === 'red' ? 'border-red-200 border-t-red-600' :
    color === 'violet' ? 'border-violet-200 border-t-violet-600' :
    'border-gray-200 border-t-gray-600';
  return <div className={`w-4 h-4 border-2 rounded-full animate-spin ${cls}`} />;
}
