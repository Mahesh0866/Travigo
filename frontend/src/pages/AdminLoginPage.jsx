import { useState, useRef, useEffect } from 'react';
import { adminLogin } from '../services/api';

export default function AdminLoginPage() {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef([]);

  // If already logged in as admin, redirect
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) window.location.href = '/admin';
  }, []);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleDigitChange = (index, value) => {
    // Allow only digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError('');

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move back to previous input on backspace
        inputRefs.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
      }
    } else if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length) {
      const newDigits = ['', '', '', '', '', ''];
      pasted.split('').forEach((ch, i) => { newDigits[i] = ch; });
      setDigits(newDigits);
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handleSubmit = async () => {
    const code = digits.join('');
    if (code.length < 6) {
      setError('Please enter the complete 6-digit code.');
      triggerShake();
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await adminLogin(code);
      localStorage.setItem('admin_token', data.admin_token);
      setSuccess(true);
      setTimeout(() => { window.location.href = '/admin'; }, 800);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Incorrect code. Please try again.';
      setError(detail);
      triggerShake();
      // Clear the inputs on wrong code
      setDigits(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const isComplete = digits.every(d => d !== '');

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background orbs */}
      <div style={{
        position: 'absolute', width: '500px', height: '500px',
        borderRadius: '50%', top: '-150px', left: '-150px',
        background: 'radial-gradient(circle, rgba(126,87,194,0.25) 0%, transparent 70%)',
        animation: 'pulse 8s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: '400px', height: '400px',
        borderRadius: '50%', bottom: '-100px', right: '-100px',
        background: 'radial-gradient(circle, rgba(74,155,255,0.2) 0%, transparent 70%)',
        animation: 'pulse 10s ease-in-out infinite 2s',
      }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          15%{transform:translateX(-8px)}
          30%{transform:translateX(8px)}
          45%{transform:translateX(-6px)}
          60%{transform:translateX(6px)}
          75%{transform:translateX(-3px)}
          90%{transform:translateX(3px)}
        }
        @keyframes fadeIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn { from{transform:scale(0.8);opacity:0} to{transform:scale(1);opacity:1} }
        .pin-box:focus { outline: none !important; }
        .submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(126,87,194,0.5) !important; }
        .submit-btn:active:not(:disabled) { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      {/* Main Card */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '28px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
        animation: 'fadeIn 0.5s ease-out',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          {/* Icon */}
          <div style={{
            width: '72px', height: '72px', borderRadius: '20px',
            background: 'linear-gradient(135deg, #7e57c2 0%, #4a9bff 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(126,87,194,0.4)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '36px', color: '#fff' }}>admin_panel_settings</span>
          </div>

          <h1 style={{
            color: '#fff', fontSize: '26px', fontWeight: '800',
            margin: '0 0 8px', letterSpacing: '-0.5px',
          }}>
            Admin Access
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
            Enter your 6-digit security code to continue
          </p>
        </div>

        {/* PIN Input */}
        <div style={{
          animation: shake ? 'shake 0.6s ease-in-out' : 'none',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '8px' }}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={el => inputRefs.current[i] = el}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                className="pin-box"
                style={{
                  width: '52px', height: '64px',
                  textAlign: 'center',
                  fontSize: digit ? '28px' : '14px',
                  fontWeight: '800',
                  color: digit ? '#fff' : 'rgba(255,255,255,0.2)',
                  background: digit
                    ? 'rgba(126,87,194,0.25)'
                    : 'rgba(255,255,255,0.05)',
                  border: digit
                    ? '2px solid rgba(126,87,194,0.7)'
                    : '2px solid rgba(255,255,255,0.12)',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  caretColor: 'transparent',
                  boxShadow: digit
                    ? '0 4px 16px rgba(126,87,194,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                    : 'none',
                  letterSpacing: digit ? '0' : '0',
                }}
              />
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              textAlign: 'center', marginTop: '12px',
              color: '#ff6b6b', fontSize: '13px', fontWeight: '500',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>
              {error}
            </div>
          )}

          {/* Success message */}
          {success && (
            <div style={{
              textAlign: 'center', marginTop: '12px',
              color: '#51cf66', fontSize: '13px', fontWeight: '500',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
              Access granted! Redirecting...
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading || success}
          className="submit-btn"
          style={{
            width: '100%', padding: '16px',
            background: isComplete
              ? 'linear-gradient(135deg, #7e57c2 0%, #4a9bff 100%)'
              : 'rgba(255,255,255,0.08)',
            border: 'none', borderRadius: '16px',
            color: isComplete ? '#fff' : 'rgba(255,255,255,0.3)',
            fontSize: '15px', fontWeight: '700',
            cursor: isComplete ? 'pointer' : 'default',
            transition: 'all 0.2s ease',
            boxShadow: isComplete ? '0 8px 24px rgba(126,87,194,0.35)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          {loading ? (
            <>
              <div style={{
                width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              Verifying...
            </>
          ) : success ? (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>check_circle</span>
              Access Granted
            </>
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>lock_open</span>
              Unlock Dashboard
            </>
          )}
        </button>

        {/* Footer note */}
        <p style={{
          textAlign: 'center', color: 'rgba(255,255,255,0.25)',
          fontSize: '12px', marginTop: '24px', lineHeight: '1.5',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '13px', verticalAlign: 'middle', marginRight: '4px' }}>
            shield
          </span>
          Travigo Travel Officer Portal · Restricted Access
        </p>

        {/* Back to site link */}
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <a
            href="/"
            style={{
              color: 'rgba(255,255,255,0.35)', fontSize: '12px',
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => e.target.closest('a').style.color = 'rgba(255,255,255,0.7)'}
            onMouseLeave={e => e.target.closest('a').style.color = 'rgba(255,255,255,0.35)'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>arrow_back</span>
            Back to site
          </a>
        </div>
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
