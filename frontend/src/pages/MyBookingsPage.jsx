import { useState, useEffect, useCallback } from 'react';
import { getMyBookings, submitBookingPayment, getUpiSettings } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import PaymentDeadlineTimer from '../components/PaymentDeadlineTimer';

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [upiSettings, setUpiSettings] = useState({ upi_id: '', qr_image_base64: '' });

  const isLoggedIn = !!localStorage.getItem('access_token');

  const loadBookings = useCallback(() => {
    setLoading(true);
    getMyBookings()
      .then(setBookings)
      .catch(() => setError('Failed to load bookings.'))
      .finally(() => setLoading(false));
  }, []);

  // Refresh UPI settings whenever page loads (always latest from admin)
  const refreshUpiSettings = useCallback(() => {
    getUpiSettings().then(setUpiSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      window.location.href = '/login';
      return;
    }
    loadBookings();
    refreshUpiSettings();
  }, []);

  const FILTERS = ['ALL', 'PENDING_ADMIN_APPROVAL', 'APPROVED', 'PENDING_PAYMENT', 'PAYMENT_VERIFICATION', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'EXPIRED'];
  const filtered = filter === 'ALL' ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-700 to-purple-700 py-14 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 text-white mb-2">
            <span className="material-symbols-outlined text-[28px]">receipt_long</span>
            <h1 className="text-3xl font-extrabold">My Bookings</h1>
          </div>
          <p className="text-purple-200">Track your booking requests, admin approvals, and payment statuses.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        {/* Filter chips */}
        {!loading && !error && bookings.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  filter === f
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-violet-300'
                }`}
              >
                {f === 'ALL' ? 'All' : f.replace(/_/g, ' ')}
                {f !== 'ALL' && (
                  <span className="ml-1 opacity-70">({bookings.filter((b) => b.status === f).length})</span>
                )}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 shadow-sm animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-gray-600">{error}</p>
          </div>
        )}

        {!loading && !error && bookings.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🧳</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No bookings yet</h2>
            <p className="text-gray-500 mb-6">Explore our travel packages and request your first trip!</p>
            <a href="/packages" className="inline-flex items-center gap-2 bg-violet-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-violet-700 transition-colors">
              <span className="material-symbols-outlined text-[18px]">flight_takeoff</span>
              View Packages
            </a>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && bookings.length > 0 && (
          <div className="text-center py-12 text-gray-500">
            No bookings with status "{filter.replace(/_/g, ' ')}".
          </div>
        )}

        <div className="space-y-4">
          {filtered.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              upiSettings={upiSettings}
              onReload={loadBookings}
              onRefreshUpi={refreshUpiSettings}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BookingCard({ booking, upiSettings, onReload, onRefreshUpi }) {
  const [expanded, setExpanded] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [upiTxnId, setUpiTxnId] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');

  const isApproved = booking.status === 'APPROVED';
  const isPendingApproval = booking.status === 'PENDING_ADMIN_APPROVAL';
  const isRejected = booking.status === 'REJECTED';
  const isPaymentVerification = booking.status === 'PAYMENT_VERIFICATION';
  const isPendingPayment = booking.status === 'PENDING_PAYMENT';
  const isConfirmed = booking.status === 'CONFIRMED';
  const isCancelled = booking.status === 'CANCELLED';
  const isExpired = booking.status === 'EXPIRED';
  const isUrgent = isPendingPayment && booking.payment_deadline;

  // When opening pay form, always refresh UPI settings to get the latest scanner
  const handleOpenPayForm = () => {
    onRefreshUpi();
    setShowPayForm(true);
  };

  const handlePaySubmit = async () => {
    setPayError('');
    if (paymentMethod === 'UPI' && !upiTxnId.trim()) {
      setPayError('Please enter the UPI Transaction ID / Reference Number');
      return;
    }
    setPayLoading(true);
    try {
      await submitBookingPayment(booking.id, {
        payment_method: paymentMethod,
        upi_transaction_id: paymentMethod === 'UPI' ? upiTxnId.trim() : undefined,
      });
      setShowPayForm(false);
      setUpiTxnId('');
      onReload();
    } catch (err) {
      let errMsg = 'Payment submission failed. Please try again.';
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        errMsg = detail;
      } else if (Array.isArray(detail)) {
        errMsg = detail.map((d) => d.msg || d.message || JSON.stringify(d)).join(', ');
      } else if (typeof detail === 'object' && detail !== null) {
        errMsg = detail.msg || detail.message || JSON.stringify(detail);
      }
      setPayError(errMsg);
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border transition-all duration-300 overflow-hidden ${
      isApproved ? 'border-teal-400 ring-2 ring-teal-100' :
      isPendingApproval ? 'border-purple-300' :
      isPaymentVerification ? 'border-blue-300 ring-2 ring-blue-50' :
      isConfirmed ? 'border-emerald-300 ring-2 ring-emerald-50' :
      isUrgent ? 'border-amber-300 shadow-amber-100' :
      'border-gray-100'
    }`}>
      <div className="p-5">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                #{booking.id}
              </span>
              <StatusBadge status={booking.status} />
              {booking.payment_method && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  booking.payment_method === 'UPI' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {booking.payment_method === 'CASH' ? '💵 Cash' : '📱 UPI'}
                </span>
              )}
            </div>
            <p className="font-semibold text-gray-800 truncate">{booking.traveler_name}</p>
            <p className="text-sm text-gray-500">
              {booking.num_travelers} traveler{booking.num_travelers > 1 ? 's' : ''} · Package #{booking.package_id}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-violet-700">₹{booking.total_amount?.toLocaleString()}</p>
            <p className="text-xs text-gray-400">
              {booking.travel_date && new Date(booking.travel_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* ─── PENDING ADMIN APPROVAL ─── */}
        {isPendingApproval && (
          <div className="mt-4 bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3 text-purple-900">
            <span className="material-symbols-outlined text-purple-600 text-[22px] mt-0.5">hourglass_top</span>
            <div className="text-sm">
              <p className="font-bold">Awaiting Admin Approval</p>
              <p className="text-xs text-purple-800 mt-0.5">
                Your request has been submitted to the Travel Officer. Payment options will unlock once your booking is approved.
              </p>
            </div>
          </div>
        )}

        {/* ─── APPROVED — Payment Step ─── */}
        {isApproved && (
          <div className="mt-4 bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-teal-900 font-bold text-sm">
                <span className="material-symbols-outlined text-teal-600 text-[20px]">thumb_up</span>
                Booking Approved — Choose Payment Method
              </div>
              {!showPayForm && (
                <button
                  onClick={handleOpenPayForm}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-5 py-2 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">payments</span>
                  Proceed to Payment
                </button>
              )}
            </div>

            {/* ── Payment Form ── */}
            {showPayForm && (
              <div className="pt-4 border-t border-teal-200 space-y-4">

                {/* Method selector */}
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Select Payment Method</p>
                  <div className="grid grid-cols-2 gap-3">
                    {['CASH', 'UPI'].map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col gap-1 ${
                          paymentMethod === method
                            ? method === 'UPI' ? 'border-blue-500 bg-blue-50' : 'border-amber-500 bg-amber-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <span className="text-base">{method === 'CASH' ? '💵' : '📱'}</span>
                        <span className="font-bold text-sm text-gray-800">{method === 'CASH' ? 'Cash' : 'Online (UPI)'}</span>
                        <span className="text-[11px] text-gray-500">
                          {method === 'CASH' ? 'Pay in person at our office' : 'Pay instantly via UPI / QR'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* CASH info */}
                {paymentMethod === 'CASH' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-[20px] mt-0.5">schedule</span>
                    <div>
                      <p className="font-semibold">5-Hour Payment Window</p>
                      <p className="text-xs mt-1 text-amber-800">
                        Selecting Cash will start a 5-hour countdown. Visit our office and pay ₹{booking.total_amount?.toLocaleString()} within this window to confirm your booking.
                      </p>
                    </div>
                  </div>
                )}

                {/* UPI Scanner — shown only here at the final payment step */}
                {paymentMethod === 'UPI' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-4">
                    <div className="text-center">
                      <p className="font-semibold text-blue-900 text-sm mb-1">Scan & Pay via UPI</p>
                      <p className="text-xs text-blue-600">Scan the QR code below using any UPI app (PhonePe, GPay, Paytm, etc.)</p>
                    </div>

                    {upiSettings.qr_image_base64 ? (
                      <div className="flex flex-col items-center gap-3">
                        {/* Large QR Scanner */}
                        <div className="bg-white p-3 rounded-2xl border-2 border-blue-200 shadow-md">
                          <img
                            src={upiSettings.qr_image_base64}
                            alt="UPI QR Scanner"
                            className="w-52 h-52 object-contain"
                          />
                        </div>
                        {upiSettings.upi_id && (
                          <div className="text-center">
                            <p className="text-xs text-blue-600 mb-1">Or pay to UPI ID:</p>
                            <p className="font-mono font-bold text-blue-900 bg-white px-4 py-2 rounded-xl border border-blue-200 text-sm shadow-sm select-all">
                              {upiSettings.upi_id}
                            </p>
                          </div>
                        )}
                        <div className="bg-white border border-blue-100 rounded-xl px-4 py-2.5 text-center">
                          <p className="text-xs text-gray-500">Amount to Pay</p>
                          <p className="text-xl font-extrabold text-violet-700">₹{booking.total_amount?.toLocaleString()}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-blue-700 text-sm">
                        <span className="material-symbols-outlined text-[40px] text-blue-300 block mb-2">qr_code</span>
                        UPI QR not configured. Please contact the travel officer.
                      </div>
                    )}

                    {/* Transaction ID input */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                        Enter UPI Transaction ID / Reference No <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={upiTxnId}
                        onChange={(e) => setUpiTxnId(e.target.value)}
                        placeholder="e.g. UPI12345678901234"
                        className="w-full border-2 border-blue-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                      />
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        Find the transaction ID in your UPI app after payment.
                      </p>
                    </div>
                  </div>
                )}

                {payError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    {payError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    onClick={() => { setShowPayForm(false); setPayError(''); setUpiTxnId(''); }}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePaySubmit}
                    disabled={payLoading}
                    className={`px-6 py-2 rounded-xl font-semibold text-sm text-white shadow-sm flex items-center gap-2 disabled:opacity-50 transition-all ${
                      paymentMethod === 'UPI' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                  >
                    {payLoading ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
                    ) : (
                      <><span className="material-symbols-outlined text-[16px]">check_circle</span>
                        {paymentMethod === 'UPI' ? 'Submit UPI Payment ✓' : 'Confirm Cash Payment ✓'}</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── PENDING PAYMENT (Cash) ─── */}
        {isPendingPayment && (
          <>
            {booking.payment_deadline && (
              <div className="mt-4 flex items-center gap-2">
                <PaymentDeadlineTimer deadline={booking.payment_deadline} />
              </div>
            )}
            {booking.payment_method === 'CASH' && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[20px] mt-0.5">storefront</span>
                <div>
                  <p className="font-semibold">Visit our office to pay</p>
                  <p className="text-xs text-amber-800 mt-1">
                    Please visit and pay <strong>₹{booking.total_amount?.toLocaleString()}</strong> within the time remaining above. Your booking will be cancelled if payment is not received.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── PAYMENT VERIFICATION (UPI submitted) ─── */}
        {isPaymentVerification && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
              <span className="material-symbols-outlined text-blue-600 text-[20px]">manage_search</span>
              UPI Payment Under Review
            </div>
            <p className="text-xs text-blue-800">
              Your UPI payment has been submitted and is being verified by the Travel Officer.
            </p>
            {booking.upi_transaction_id && (
              <div className="bg-white border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">Transaction ID:</span>
                <code className="font-mono text-xs text-blue-800 font-semibold">{booking.upi_transaction_id}</code>
              </div>
            )}
          </div>
        )}

        {/* ─── REJECTED (request) ─── */}
        {isRejected && (
          <div className="mt-4 bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-900 text-sm">
            <div className="flex items-center gap-2 font-bold mb-1">
              <span className="material-symbols-outlined text-rose-600 text-[20px]">cancel</span>
              Booking Request Rejected by Travel Officer
            </div>
            {booking.admin_note && (
              <p className="text-xs text-rose-800 bg-white/60 p-2 rounded border border-rose-100 mt-2 italic">
                Reason: "{booking.admin_note}"
              </p>
            )}
          </div>
        )}

        {/* ─── CANCELLED ─── */}
        {isCancelled && (
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-700 text-sm">
            <div className="flex items-center gap-2 font-bold mb-1">
              <span className="material-symbols-outlined text-gray-500 text-[20px]">block</span>
              Booking Cancelled
            </div>
            {booking.admin_note && (
              <p className="text-xs text-gray-600 italic mt-1">Note: "{booking.admin_note}"</p>
            )}
          </div>
        )}

        {/* ─── EXPIRED ─── */}
        {isExpired && (
          <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4 text-orange-900 text-sm">
            <div className="flex items-center gap-2 font-bold mb-1">
              <span className="material-symbols-outlined text-orange-600 text-[20px]">timer_off</span>
              Payment Window Expired
            </div>
            <p className="text-xs text-orange-800 mt-1">
              Your cash payment deadline passed. Contact the travel officer for assistance or to reset the booking.
            </p>
          </div>
        )}

        {/* ─── CONFIRMED ─── */}
        {isConfirmed && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-900">
            <span className="material-symbols-outlined text-emerald-600 text-[28px]">check_circle</span>
            <div>
              <p className="font-bold text-sm">Booking Confirmed! 🎉</p>
              <p className="text-xs text-emerald-800 mt-0.5">Your payment has been verified. Enjoy your trip!</p>
            </div>
          </div>
        )}

        {/* Admin note (non-rejection) */}
        {booking.admin_note && !isRejected && !isCancelled && (
          <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-700">
            <span className="font-semibold">Admin note:</span> {booking.admin_note}
          </div>
        )}

        {/* Expand button */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-4 text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1 transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">{expanded ? 'expand_less' : 'expand_more'}</span>
          {expanded ? 'Hide details' : 'View details'}
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-sm text-gray-600">
            <div><span className="font-medium text-gray-700">Mobile:</span> {booking.traveler_mobile}</div>
            <div><span className="font-medium text-gray-700">Email:</span> {booking.traveler_email}</div>
            <div><span className="font-medium text-gray-700">Package ID:</span> {booking.package_id}</div>
            <div><span className="font-medium text-gray-700">Booked:</span> {booking.created_at && new Date(booking.created_at).toLocaleDateString('en-IN')}</div>
            {booking.payment_method && <div><span className="font-medium text-gray-700">Payment:</span> {booking.payment_method}</div>}
            {booking.upi_transaction_id && <div className="col-span-2"><span className="font-medium text-gray-700">UPI Txn ID:</span> <code className="font-mono text-xs">{booking.upi_transaction_id}</code></div>}
          </div>
        )}
      </div>
    </div>
  );
}
