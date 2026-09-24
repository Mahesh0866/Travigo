import { useState, useMemo } from 'react';
import apiClient from '../services/api';

// ── Validation helpers ──────────────────────────────────────────
const validateFullName = (v) => {
  if (!v.trim()) return '';                       // empty = no error yet (untouched feel)
  if (v.trim().length < 2) return 'Must be at least 2 characters.';
  return '';
};

const validateEmail = (v) => {
  if (!v.trim()) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Enter a valid email address.';
  return '';
};

const validateMobile = (v) => {
  if (!v.trim()) return '';
  if (/[^0-9]/.test(v)) return 'Only numeric digits are allowed.';
  if (v.length < 10) return `Enter 10 digits (${v.length}/10).`;
  if (v.length > 10) return 'Must be exactly 10 digits.';
  return '';
};

const passwordRules = (v) => [
  { label: 'At least 8 characters', pass: v.length >= 8 },
  { label: '1 uppercase letter (A-Z)', pass: /[A-Z]/.test(v) },
  { label: '1 lowercase letter (a-z)', pass: /[a-z]/.test(v) },
  { label: '1 number (0-9)', pass: /[0-9]/.test(v) },
  { label: '1 special character (@, #, $, %, !)', pass: /[^A-Za-z0-9]/.test(v) },
];

const validateConfirmPassword = (pw, cpw) => {
  if (!cpw) return '';
  if (pw !== cpw) return 'Passwords do not match.';
  return '';
};

// ── Styled helpers ──────────────────────────────────────────────
const inputBase =
  'w-full bg-white border rounded-lg px-md py-sm font-body-md focus:outline-none focus:ring-2 transition-all';
const inputOk = `${inputBase} border-outline-variant focus:ring-primary/20 focus:border-primary`;
const inputErr = `${inputBase} border-red-400 focus:ring-red-200 focus:border-red-500`;

const FieldError = ({ msg }) =>
  msg ? (
    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
      <span className="material-symbols-outlined text-[14px]">error</span>
      {msg}
    </p>
  ) : null;

// ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Track whether user has started typing (to avoid showing errors on a blank form)
  const [touched, setTouched] = useState({});
  const touch = (field) => setTouched((t) => ({ ...t, [field]: true }));

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  // ── Real-time per-field errors ────────────────────────────────
  const nameErr = useMemo(() => (touched.fullName ? validateFullName(fullName) : ''), [fullName, touched.fullName]);
  const emailErr = useMemo(() => (touched.email ? validateEmail(email) : ''), [email, touched.email]);
  const mobileErr = useMemo(() => (touched.mobile ? validateMobile(mobile) : ''), [mobile, touched.mobile]);
  const pwRules = useMemo(() => passwordRules(password), [password]);
  const pwAllPass = pwRules.every((r) => r.pass);
  const confirmErr = useMemo(
    () => (touched.confirmPassword ? validateConfirmPassword(password, confirmPassword) : ''),
    [password, confirmPassword, touched.confirmPassword],
  );

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'login') {
      if (!email.trim() || !password) {
        setError('Please enter both email and password.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError('Please enter a valid email address.');
        return;
      }
    } else {
      // Touch everything so errors show
      setTouched({ fullName: true, email: true, mobile: true, password: true, confirmPassword: true });

      if (!fullName.trim() || !email.trim() || !mobile.trim() || !password || !confirmPassword) {
        setError('All fields are required.');
        return;
      }
      if (validateFullName(fullName)) { setError(validateFullName(fullName)); return; }
      if (validateEmail(email)) { setError(validateEmail(email)); return; }
      if (validateMobile(mobile)) { setError(validateMobile(mobile)); return; }
      if (!pwAllPass) { setError('Password does not meet all requirements.'); return; }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await apiClient.post('/auth/login', { email: email.trim(), password });
        localStorage.setItem('access_token', res.data.access_token);
        localStorage.setItem('is_admin', res.data.is_admin ? 'true' : 'false');
        setSuccess('Logged in! Redirecting…');
        setTimeout(() => (window.location.href = '/'), 1000);
      } else {
        await apiClient.post('/auth/register', {
          email: email.trim(),
          password,
          confirm_password: confirmPassword,
          full_name: fullName.trim(),
          mobile: mobile.trim(),
        });
        setSuccess('Account created! You can now log in.');
        setMode('login');
        setFullName('');
        setMobile('');
        setPassword('');
        setConfirmPassword('');
        setTouched({});
      }
    } catch (err) {
      let errMsg = 'Something went wrong. Please try again.';
      const detail = err.response?.data?.detail;
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

  const handleToggleMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setFullName('');
    setMobile('');
    setPassword('');
    setConfirmPassword('');
    setTouched({});
  };

  return (
    <main className="flex-grow flex items-center justify-center bg-surface-container-low px-margin-mobile py-xl relative overflow-hidden min-h-[700px]">
      {/* Atmospheric background */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,_#f8d8ff_0%,_transparent_50%)]" />

      <div
        className="bg-white border border-surface-variant rounded-xl w-full max-w-md p-lg md:p-xl relative z-10"
        style={{ boxShadow: '0px 10px 30px rgba(94,54,112,0.12)', animation: 'fadeInUp 0.5s ease-out forwards' }}
      >
        <div className="text-center mb-lg">
          <h1 className="font-headline-lg text-headline-lg text-primary mb-xs">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {mode === 'login' ? 'Sign in to explore your local gems' : 'Join Travigo and start exploring'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex rounded-lg bg-surface-container p-1 mb-lg gap-1">
          <button
            type="button"
            onClick={() => handleToggleMode('login')}
            className={`flex-1 py-sm rounded-md font-label-md text-label-md transition-all ${mode === 'login' ? 'bg-white text-primary shadow-sm font-bold' : 'text-on-surface-variant'
              }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => handleToggleMode('register')}
            className={`flex-1 py-sm rounded-md font-label-md text-label-md transition-all ${mode === 'register' ? 'bg-white text-primary shadow-sm font-bold' : 'text-on-surface-variant'
              }`}
          >
            Sign Up
          </button>
        </div>

        <form className="space-y-md" onSubmit={handleSubmit} noValidate>
          {/* ── Full Name ───────────────────────── */}
          {mode === 'register' && (
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs" htmlFor="fullName">
                Full Name
              </label>
              <input
                className={nameErr ? inputErr : inputOk}
                id="fullName"
                type="text"
                placeholder="Alex Rivera"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); touch('fullName'); }}
                onBlur={() => touch('fullName')}
                required
              />
              <FieldError msg={nameErr} />
            </div>
          )}

          {/* ── Email ───────────────────────────── */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-xs" htmlFor="email">
              Email Address
            </label>
            <input
              className={emailErr ? inputErr : inputOk}
              id="email"
              type="email"
              placeholder="alex@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); touch('email'); }}
              onBlur={() => touch('email')}
              required
            />
            <FieldError msg={emailErr} />
          </div>

          {/* ── Mobile ──────────────────────────── */}
          {mode === 'register' && (
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs" htmlFor="mobile">
                Mobile Number
              </label>
              <input
                className={mobileErr ? inputErr : inputOk}
                id="mobile"
                type="tel"
                placeholder="9876543210"
                maxLength={10}
                value={mobile}
                onChange={(e) => {
                  // Strip non-digits as user types
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setMobile(digits);
                  touch('mobile');
                }}
                onBlur={() => touch('mobile')}
                required
              />
              <FieldError msg={mobileErr} />
            </div>
          )}

          {/* ── Password ────────────────────────── */}
          <div>
            <div className="flex justify-between items-center mb-xs">
              <label className="block font-label-md text-label-md text-on-surface-variant" htmlFor="password">
                Password
              </label>
              {mode === 'login' && (
                <a className="font-label-sm text-label-sm text-primary hover:underline" href="#">Forgot?</a>
              )}
            </div>
            <input
              className={touched.password && !pwAllPass && mode === 'register' ? inputErr : inputOk}
              id="password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); touch('password'); }}
              onBlur={() => touch('password')}
              required
            />
            {/* Live password checklist (register only) */}
            {mode === 'register' && touched.password && password.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {pwRules.map((rule) => (
                  <li key={rule.label} className={`text-xs flex items-center gap-1 ${rule.pass ? 'text-green-600' : 'text-red-500'}`}>
                    <span className="material-symbols-outlined text-[14px]">
                      {rule.pass ? 'check_circle' : 'cancel'}
                    </span>
                    {rule.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Confirm Password ─────────────────── */}
          {mode === 'register' && (
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <input
                className={confirmErr ? inputErr : inputOk}
                id="confirmPassword"
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); touch('confirmPassword'); }}
                onBlur={() => touch('confirmPassword')}
                required
              />
              <FieldError msg={confirmErr} />
              {/* Green match indicator */}
              {touched.confirmPassword && confirmPassword && !confirmErr && (
                <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Passwords match
                </p>
              )}
            </div>
          )}

          {/* ── Global form error (from server or submit-time checks) */}
          {error && (
            <p className="font-label-sm text-label-sm text-error flex items-center gap-xs">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {error}
            </p>
          )}

          {success && (
            <p className="font-label-sm text-label-sm text-primary flex items-center gap-xs">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              {success}
            </p>
          )}

          <button
            className="w-full bg-primary text-on-primary font-label-md text-label-md py-md rounded-lg shadow-md hover:bg-on-secondary-fixed-variant transition-all duration-200 active:scale-95 flex justify-center items-center gap-sm"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <span className="animate-spin material-symbols-outlined text-[20px]">progress_activity</span>
            ) : (
              <>
                {mode === 'login' ? 'Login' : 'Create Account'}
                <span className="material-symbols-outlined">arrow_forward</span>
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
