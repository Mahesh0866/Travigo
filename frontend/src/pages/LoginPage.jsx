import { useState } from 'react';
import apiClient from '../services/api';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

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
    } else if (mode === 'register') {
      if (!fullName.trim() || !email.trim() || !mobile.trim() || !password || !confirmPassword) {
        setError('All fields are required.');
        return;
      }
      if (fullName.trim().length < 2) {
        setError('Full name must be at least 2 characters.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError('Please enter a valid email address.');
        return;
      }
      if (!/^\+?[0-9]{10,15}$/.test(mobile.trim())) {
        setError('Please enter a valid mobile number (10 to 15 digits).');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
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
          mobile: mobile.trim()
        });
        setSuccess('Account created! You can now log in.');
        setMode('login');
        setFullName('');
        setMobile('');
        setPassword('');
        setConfirmPassword('');
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
            className={`flex-1 py-sm rounded-md font-label-md text-label-md transition-all ${
              mode === 'login' ? 'bg-white text-primary shadow-sm font-bold' : 'text-on-surface-variant'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => handleToggleMode('register')}
            className={`flex-1 py-sm rounded-md font-label-md text-label-md transition-all ${
              mode === 'register' ? 'bg-white text-primary shadow-sm font-bold' : 'text-on-surface-variant'
            }`}
          >
            Sign Up
          </button>
          <a
            href="/admin-login"
            className="flex-1 py-sm rounded-md font-label-md text-label-md transition-all text-center bg-violet-50 text-violet-700 hover:bg-violet-100 flex items-center justify-center gap-xs font-bold border border-violet-200"
          >
            <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
            Admin
          </a>
        </div>

        <form className="space-y-md" onSubmit={handleSubmit} noValidate>
          {mode === 'register' && (
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs" htmlFor="fullName">
                Full Name
              </label>
              <input
                className="w-full bg-white border border-outline-variant rounded-lg px-md py-sm font-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                id="fullName"
                type="text"
                placeholder="Alex Rivera"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-xs" htmlFor="email">
              Email Address
            </label>
            <input
              className="w-full bg-white border border-outline-variant rounded-lg px-md py-sm font-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              id="email"
              type="email"
              placeholder="alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs" htmlFor="mobile">
                Mobile Number
              </label>
              <input
                className="w-full bg-white border border-outline-variant rounded-lg px-md py-sm font-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                id="mobile"
                type="tel"
                placeholder="9876543210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
              />
            </div>
          )}

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
              className="w-full bg-white border border-outline-variant rounded-lg px-md py-sm font-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              id="password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <input
                className="w-full bg-white border border-outline-variant rounded-lg px-md py-sm font-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                id="confirmPassword"
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          )}

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

          {mode === 'login' && (
            <div className="mt-lg pt-md border-t border-surface-variant text-center">
              <a
                href="/admin-login"
                className="inline-flex items-center gap-xs text-label-md font-label-md text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-md py-xs rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">key</span>
                Admin / Travel Officer 6-Digit Login
              </a>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
