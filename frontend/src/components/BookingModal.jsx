import { useState, useEffect, useRef } from 'react';
import { createBooking, getProfile, getUpiSettings } from '../services/api';

// Step labels for the progress bar
const STEPS = ['1. Package', '2. Traveler Details', '3. Payment Method', '4. Payment'];

// 5 minutes in seconds
const UPI_TIMER_SECONDS = 300;

export default function BookingModal({ pkg, onClose, onSuccess }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    traveler_name: '',
    traveler_mobile: '',
    traveler_email: '',
    num_travelers: 1,
    travel_date: pkg?.travel_date || '',
  });
  const [paymentMethod, setPaymentMethod] = useState(''); // 'CASH' | 'UPI'
  const [upiTxnId, setUpiTxnId] = useState('');
  const [upiSettings, setUpiSettings] = useState({ upi_id: '', upi_qr_url: '' });
  const [upiLoading, setUpiLoading] = useState(false);

  // 5-minute countdown timer for UPI
  const [timerSeconds, setTimerSeconds] = useState(UPI_TIMER_SECONDS);
  const [timerStarted, setTimerStarted] = useState(false);
  const timerRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdBooking, setCreatedBooking] = useState(null);

  const totalAmount = (pkg?.price || 0) * form.num_travelers;

  // Pre-fill profile data
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      getProfile()
        .then((profile) => {
          setForm((prev) => ({
            ...prev,
            traveler_name: profile.full_name || '',
            traveler_email: profile.email || '',
            traveler_mobile: profile.mobile || '',
          }));
        })
        .catch(() => {});
    }
  }, []);

  // Start UPI countdown timer when we reach Step 3 with UPI method
  useEffect(() => {
    if (step === 3 && paymentMethod === 'UPI' && !timerStarted) {
      setTimerStarted(true);
      setTimerSeconds(UPI_TIMER_SECONDS);
      timerRef.current = setInterval(() => {
        setTimerSeconds((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (step !== 3) clearInterval(timerRef.current);
    };
  }, [step, paymentMethod]);

  // Fetch latest UPI settings when entering Step 3 with UPI
  useEffect(() => {
    if (step === 3 && paymentMethod === 'UPI') {
      setUpiLoading(true);
      getUpiSettings()
        .then(setUpiSettings)
        .catch(() => {})
        .finally(() => setUpiLoading(false));
    }
  }, [step, paymentMethod]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'num_travelers' ? parseInt(value) || 1 : value,
    }));
  };

  const validateStep1 = () => {
    if (!form.traveler_name.trim() || form.traveler_name.trim().length < 2) {
      return 'Full name is required (at least 2 characters)';
    }
    if (!/^\+?[0-9]{10,15}$/.test(form.traveler_mobile.trim())) {
      return 'Valid mobile number (10 to 15 digits) required';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.traveler_email.trim())) {
      return 'Valid email address required (e.g. name@example.com)';
    }
    if (!form.num_travelers || form.num_travelers < 1) {
      return 'At least 1 traveler required';
    }
    if (form.num_travelers > pkg.available_seats) {
      return `Only ${pkg.available_seats} seat(s) available on this package`;
    }
    if (!form.travel_date) {
      return 'Travel date is required';
    }
    return '';
  };

  const handleNext = () => {
    setError('');
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
    }
    if (step === 2 && !paymentMethod) {
      setError('Please select a payment method to continue.');
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setError('');
    setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    setError('');
    if (paymentMethod === 'UPI' && !upiTxnId.trim()) {
      setError('Please enter your UPI Transaction / Reference ID after making the payment.');
      return;
    }
    setLoading(true);
    try {
      const booking = await createBooking({
        package_id: pkg.id,
        traveler_name: form.traveler_name.trim(),
        traveler_mobile: form.traveler_mobile.trim(),
        traveler_email: form.traveler_email.trim(),
        num_travelers: form.num_travelers,
        travel_date: form.travel_date,
        payment_method: paymentMethod,
        upi_transaction_id: paymentMethod === 'UPI' ? upiTxnId.trim() : null,
      });
      clearInterval(timerRef.current);
      setCreatedBooking(booking);
      setStep(4); // success screen
      if (onSuccess) onSuccess(booking);
    } catch (e) {
      let errMsg = 'Booking submission failed. Please try again.';
      const detail = e.response?.data?.detail;
      if (typeof detail === 'string') {
        errMsg = detail;
      } else if (Array.isArray(detail)) {
        errMsg = detail.map((d) => d.msg || d.message || JSON.stringify(d)).join(', ');
      } else if (typeof detail === 'object' && detail !== null) {
        errMsg = detail.msg || detail.message || JSON.stringify(detail);
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Format seconds → MM:SS
  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const timerUrgent = timerSeconds <= 60;
  const timerDone = timerSeconds === 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={step < 4 ? onClose : undefined} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh]">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-5 text-white flex-shrink-0">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold">Book Your Trip</h2>
              <p className="text-purple-200 text-sm mt-0.5 line-clamp-1">{pkg?.name}</p>
            </div>
            {step < 4 && (
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            )}
          </div>

          {/* Step progress indicator — only steps 0–3 */}
          {step < 4 && (
            <div className="flex items-center">
              {STEPS.map((label, i) => (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      i < step ? 'bg-white text-purple-700' :
                      i === step ? 'bg-white text-purple-700 ring-2 ring-white/50 ring-offset-1 ring-offset-purple-600' :
                      'bg-white/20 text-white/60'
                    }`}>
                      {i < step ? '✓' : i + 1}
                    </div>
                    <span className={`text-[9px] font-semibold tracking-wide ${i === step ? 'text-white' : 'text-purple-300'}`}>
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-px mx-1 mb-3 transition-all ${i < step ? 'bg-white' : 'bg-white/25'}`} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 p-6">

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] flex-shrink-0">error</span>
              {error}
            </div>
          )}

          {/* ──────────────────────────────────────────── */}
          {/* STEP 0 — Package Overview                    */}
          {/* ──────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              {pkg?.image_url && (
                <div className="rounded-xl overflow-hidden h-36">
                  <img src={pkg.image_url} alt={pkg.name} className="w-full h-full object-cover" />
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-gray-900">{pkg?.name}</h3>
                <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-1">
                  <span className="material-symbols-outlined text-[16px]">location_on</span>
                  <span>{pkg?.origin} → <strong className="text-gray-700">{pkg?.destination}</strong></span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-violet-50 rounded-xl p-3">
                  <p className="text-xs text-violet-500 font-medium">Price per person</p>
                  <p className="text-xl font-extrabold text-violet-700">₹{pkg?.price?.toLocaleString()}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3">
                  <p className="text-xs text-purple-500 font-medium">Available Seats</p>
                  <p className="text-xl font-extrabold text-purple-700">{pkg?.available_seats}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 font-medium">Travel Date</p>
                  <p className="text-sm font-bold text-slate-700">
                    {pkg?.travel_date && new Date(pkg.travel_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 font-medium">Return Date</p>
                  <p className="text-sm font-bold text-slate-700">
                    {pkg?.return_date && new Date(pkg.return_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {pkg?.included_services?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What's included</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pkg.included_services.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full border border-emerald-100">
                        <span className="material-symbols-outlined text-[12px]">check_circle</span>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {pkg?.description && (
                <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">{pkg.description}</p>
              )}

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2 text-xs text-blue-800">
                <span className="material-symbols-outlined text-[15px] mt-0.5 flex-shrink-0">info</span>
                <span>Your booking request will be reviewed by a Travel Officer. Payment can be made via Cash or UPI after selecting your preferred method.</span>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────── */}
          {/* STEP 1 — Traveler Details                    */}
          {/* ──────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-violet-50 rounded-xl p-3 text-sm text-violet-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">flight_takeoff</span>
                <span><strong>{pkg?.destination}</strong> · ₹{pkg?.price?.toLocaleString()}/person · {pkg?.available_seats} seats left</span>
              </div>

              {[
                { label: 'Full Name', name: 'traveler_name', type: 'text', placeholder: 'e.g. Rahul Sharma' },
                { label: 'Mobile Number', name: 'traveler_mobile', type: 'tel', placeholder: '10-digit mobile number' },
                { label: 'Email Address', name: 'traveler_email', type: 'email', placeholder: 'you@example.com' },
              ].map(({ label, name, type, placeholder }) => (
                <div key={name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={type}
                    name={name}
                    value={form[name]}
                    onChange={handleChange}
                    placeholder={placeholder}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50 text-gray-800"
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Travelers</label>
                  <input
                    type="number"
                    name="num_travelers"
                    value={form.num_travelers}
                    onChange={handleChange}
                    min={1}
                    max={pkg?.available_seats}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Travel Date</label>
                  <input
                    type="date"
                    name="travel_date"
                    value={form.travel_date}
                    onChange={handleChange}
                    min={pkg?.travel_date}
                    max={pkg?.travel_date}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50"
                  />
                </div>
              </div>

              {/* Running total */}
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-3 flex justify-between items-center border border-violet-100">
                <span className="text-sm text-gray-600">{form.num_travelers} × ₹{pkg?.price?.toLocaleString()}</span>
                <span className="text-lg font-bold text-violet-700">₹{totalAmount.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────── */}
          {/* STEP 2 — Select Payment Method               */}
          {/* ──────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-gray-800 mb-1">How would you like to pay?</h3>
                <p className="text-xs text-gray-500">Choose your preferred payment method. The QR scanner will be shown on the next step.</p>
              </div>

              <div className="space-y-3">
                {/* UPI Card */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('UPI')}
                  className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${
                    paymentMethod === 'UPI'
                      ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                      paymentMethod === 'UPI' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      📱
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">Online (UPI)</p>
                      <p className="text-xs text-gray-500 mt-0.5">Pay instantly via PhonePe, GPay, Paytm, or any UPI app</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      paymentMethod === 'UPI' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                    }`}>
                      {paymentMethod === 'UPI' && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                  </div>
                  {paymentMethod === 'UPI' && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <div className="flex items-center gap-2 text-xs text-blue-700">
                        <span className="material-symbols-outlined text-[14px]">qr_code_scanner</span>
                        <span>A UPI QR Scanner will be shown on the next step to scan and pay</span>
                      </div>
                    </div>
                  )}
                </button>

                {/* Cash Card */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${
                    paymentMethod === 'CASH'
                      ? 'border-amber-500 bg-amber-50 shadow-md shadow-amber-100'
                      : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/30'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                      paymentMethod === 'CASH' ? 'bg-amber-100' : 'bg-gray-100'
                    }`}>
                      💵
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">Cash</p>
                      <p className="text-xs text-gray-500 mt-0.5">Visit our office and pay in cash within a 5-hour window</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      paymentMethod === 'CASH' ? 'border-amber-500 bg-amber-500' : 'border-gray-300'
                    }`}>
                      {paymentMethod === 'CASH' && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                  </div>
                  {paymentMethod === 'CASH' && (
                    <div className="mt-3 pt-3 border-t border-amber-200">
                      <div className="flex items-center gap-2 text-xs text-amber-700">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        <span>A 5-hour payment deadline starts once Admin approves your booking</span>
                      </div>
                    </div>
                  )}
                </button>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center border border-gray-100">
                <span className="text-sm text-gray-600">Total Amount</span>
                <span className="text-lg font-bold text-violet-700">₹{totalAmount.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────── */}
          {/* STEP 3 — Payment (UPI Scanner OR Cash info)  */}
          {/* ──────────────────────────────────────────── */}
          {step === 3 && paymentMethod === 'UPI' && (
            <div className="space-y-5">
              {/* Timer Banner */}
              <div className={`rounded-2xl p-4 flex items-center gap-3 ${
                timerDone ? 'bg-amber-50 border-2 border-amber-300' :
                timerUrgent ? 'bg-orange-50 border-2 border-orange-300' :
                'bg-blue-50 border-2 border-blue-200'
              }`}>
                <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center font-mono font-black text-lg leading-none flex-shrink-0 ${
                  timerDone ? 'bg-amber-100 text-amber-700' :
                  timerUrgent ? 'bg-orange-100 text-orange-600' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  <span className="text-xl">{formatTimer(timerSeconds)}</span>
                </div>
                <div>
                  <p className={`font-bold text-sm ${timerDone ? 'text-amber-800' : timerUrgent ? 'text-orange-700' : 'text-blue-800'}`}>
                    {timerDone
                      ? 'Payment Time Ended'
                      : `UPI Payment Time Remaining: ${formatTimer(timerSeconds)}`}
                  </p>
                  <p className={`text-xs mt-0.5 ${timerDone ? 'text-amber-700' : timerUrgent ? 'text-orange-600' : 'text-blue-600'}`}>
                    {timerDone
                      ? 'Please complete your payment or contact the Travel Officer.'
                      : 'Scan the QR code below using any UPI app, complete payment, then enter your Transaction ID.'}
                  </p>
                </div>
              </div>

              {/* Big QR Scanner */}
              <div className="text-center">
                <p className="font-bold text-gray-800 text-sm mb-1">Scan & Pay via UPI</p>
                <p className="text-xs text-gray-500 mb-4">Open any UPI app → Scan QR → Pay ₹{totalAmount.toLocaleString()}</p>

                {upiLoading ? (
                  <div className="flex items-center justify-center h-72 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <div className="text-center">
                      <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" style={{ borderWidth: '3px' }} />
                      <p className="text-xs text-gray-400">Loading QR Scanner...</p>
                    </div>
                  </div>
                ) : upiSettings.upi_qr_url ? (
                  <div className="flex flex-col items-center gap-4">
                    {/* LARGE QR Code display */}
                    <div className="bg-white rounded-3xl border-4 border-blue-200 shadow-xl shadow-blue-100 p-4 inline-block">
                      <img
                        src={upiSettings.upi_qr_url}
                        alt="UPI QR Scanner"
                        className="w-72 h-72 object-contain"
                        style={{ imageRendering: 'crisp-edges' }}
                      />
                    </div>

                    {/* UPI ID */}
                    {upiSettings.upi_id && (
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Or pay to UPI ID</p>
                        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                          <span className="material-symbols-outlined text-blue-500 text-[16px]">alternate_email</span>
                          <span className="font-mono font-bold text-blue-900 text-sm select-all">{upiSettings.upi_id}</span>
                          <button
                            onClick={() => navigator.clipboard?.writeText(upiSettings.upi_id)}
                            className="text-blue-400 hover:text-blue-600 transition-colors"
                            title="Copy UPI ID"
                          >
                            <span className="material-symbols-outlined text-[15px]">content_copy</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Amount badge */}
                    <div className="bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-2xl px-6 py-3 text-center shadow-lg">
                      <p className="text-xs text-purple-200 mb-0.5">Amount to Pay</p>
                      <p className="text-2xl font-black">₹{totalAmount.toLocaleString()}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 bg-blue-50 rounded-2xl border-2 border-dashed border-blue-200">
                    <div className="text-center">
                      <span className="material-symbols-outlined text-[56px] text-blue-200 block mb-2">qr_code</span>
                      <p className="text-sm text-blue-700 font-medium">UPI QR not configured</p>
                      <p className="text-xs text-blue-500 mt-1">Contact the Travel Officer for payment details.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Transaction ID Input */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2">
                <label className="block text-sm font-bold text-gray-800">
                  UPI Transaction ID / Reference No <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500">After completing payment, find the Transaction ID in your UPI app and enter it below.</p>
                <input
                  type="text"
                  value={upiTxnId}
                  onChange={(e) => setUpiTxnId(e.target.value)}
                  placeholder="e.g. UPI12345678901234"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                />
              </div>

              {/* Admin approval notice */}
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 flex items-start gap-2 text-xs text-purple-800">
                <span className="material-symbols-outlined text-[15px] mt-0.5 flex-shrink-0">admin_panel_settings</span>
                <span>Your booking will be reviewed by the Travel Officer. It becomes <strong>CONFIRMED</strong> only after the admin verifies your UPI payment.</span>
              </div>
            </div>
          )}

          {step === 3 && paymentMethod === 'CASH' && (
            <div className="space-y-5">
              {/* Cash icon */}
              <div className="text-center py-4">
                <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-100">
                  <span className="text-5xl">💵</span>
                </div>
                <h3 className="text-lg font-bold text-gray-800">Cash Payment</h3>
                <p className="text-sm text-gray-500 mt-1">Visit our office to pay after admin approval</p>
              </div>

              {/* Instructions */}
              <div className="space-y-3">
                {[
                  { icon: 'thumb_up', color: 'text-teal-600 bg-teal-50', title: 'Step 1 — Wait for Approval', desc: 'Your booking request will be reviewed by the Travel Officer first.' },
                  { icon: 'schedule', color: 'text-amber-600 bg-amber-50', title: 'Step 2 — 5-Hour Window Opens', desc: 'Once approved, a 5-hour payment window begins. You must pay within this time.' },
                  { icon: 'storefront', color: 'text-violet-600 bg-violet-50', title: 'Step 3 — Visit Our Office', desc: `Pay ₹${totalAmount.toLocaleString()} in cash at our office before the deadline.` },
                  { icon: 'check_circle', color: 'text-emerald-600 bg-emerald-50', title: 'Step 4 — Booking Confirmed', desc: 'Admin will confirm your cash payment and your booking will be CONFIRMED.' },
                ].map(({ icon, color, title, desc }) => (
                  <div key={title} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                      <span className="material-symbols-outlined text-[20px]">{icon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-xs text-amber-600 font-medium">Amount Due</p>
                  <p className="text-xs text-amber-700 mt-0.5">{form.num_travelers} traveler(s) × ₹{pkg?.price?.toLocaleString()}</p>
                </div>
                <p className="text-2xl font-black text-amber-700">₹{totalAmount.toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────── */}
          {/* STEP 4 — Success Screen                      */}
          {/* ──────────────────────────────────────────── */}
          {step === 4 && createdBooking && (
            <div className="text-center space-y-5 py-2">
              <div className="w-24 h-24 rounded-full bg-purple-100 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-purple-600 text-[48px]">check_circle</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Booking Submitted!</h3>
                <p className="text-gray-500 text-sm mt-1">
                  Booking ID: <strong className="font-mono text-violet-700">#{createdBooking.id}</strong>
                </p>
              </div>

              <div className={`rounded-2xl p-4 text-left space-y-2 ${
                paymentMethod === 'UPI' ? 'bg-blue-50 border border-blue-200' : 'bg-amber-50 border border-amber-200'
              }`}>
                <div className={`flex items-center gap-2 font-bold text-sm ${paymentMethod === 'UPI' ? 'text-blue-900' : 'text-amber-900'}`}>
                  <span className="material-symbols-outlined text-[18px]">
                    {paymentMethod === 'UPI' ? 'manage_search' : 'schedule'}
                  </span>
                  {paymentMethod === 'UPI' ? 'UPI Payment Under Review' : 'Awaiting Admin Approval'}
                </div>
                <p className={`text-xs leading-relaxed ${paymentMethod === 'UPI' ? 'text-blue-800' : 'text-amber-800'}`}>
                  {paymentMethod === 'UPI'
                    ? 'Your UPI payment details have been submitted. The Travel Officer will verify and confirm your booking.'
                    : 'Your booking request has been submitted. Once the admin approves it, a 5-hour window will open for you to pay in cash at our office.'}
                </p>
                {paymentMethod === 'UPI' && createdBooking.upi_transaction_id && (
                  <div className="bg-white rounded-lg px-3 py-2 flex items-center gap-2 border border-blue-100">
                    <span className="text-xs text-gray-500">Txn ID:</span>
                    <code className="font-mono text-xs text-blue-800 font-semibold">{createdBooking.upi_transaction_id}</code>
                  </div>
                )}
              </div>

              <a
                href="/my-bookings"
                className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:underline"
              >
                <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                View in My Bookings →
              </a>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 flex justify-between items-center gap-3">
          {step === 4 ? (
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-violet-600 to-purple-700 text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Close
            </button>
          ) : (
            <>
              {/* Back / Cancel */}
              <button
                onClick={step === 0 ? onClose : handleBack}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                {step === 0 ? 'Cancel' : '← Back'}
              </button>

              {/* Next / Submit */}
              {step < 3 ? (
                <button
                  onClick={handleNext}
                  className="flex-1 bg-gradient-to-r from-violet-600 to-purple-700 text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  {step === 2 ? `Proceed to ${paymentMethod === 'UPI' ? 'Scan & Pay' : paymentMethod === 'CASH' ? 'Cash Payment' : 'Payment'} →` : 'Next →'}
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading || (paymentMethod === 'UPI' && !upiTxnId.trim())}
                  className={`flex-1 text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 ${
                    paymentMethod === 'UPI'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700'
                      : 'bg-gradient-to-r from-amber-500 to-amber-600'
                  }`}
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
                  ) : paymentMethod === 'UPI' ? (
                    <><span className="material-symbols-outlined text-[16px]">send</span> Submit Booking</>
                  ) : (
                    <><span className="material-symbols-outlined text-[16px]">check_circle</span> Confirm Cash Booking</>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
