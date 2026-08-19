import { useState, useEffect } from 'react';

/**
 * PaymentDeadlineTimer — live countdown for PENDING_PAYMENT bookings.
 * Shows HH:MM:SS remaining. Turns red when < 30 minutes remain.
 */
export default function PaymentDeadlineTimer({ deadline }) {
  const [timeLeft, setTimeLeft] = useState(getSecondsLeft(deadline));

  useEffect(() => {
    if (!deadline) return;
    const interval = setInterval(() => {
      setTimeLeft(getSecondsLeft(deadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;

  if (timeLeft <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-sm">
        <span className="material-symbols-outlined text-[16px]">timer_off</span>
        Deadline passed
      </span>
    );
  }

  const h = Math.floor(timeLeft / 3600);
  const m = Math.floor((timeLeft % 3600) / 60);
  const s = timeLeft % 60;
  const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  const isUrgent = timeLeft < 30 * 60; // < 30 minutes

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-semibold text-sm px-2.5 py-1 rounded-lg ${
        isUrgent
          ? 'bg-red-100 text-red-700 animate-pulse'
          : 'bg-amber-100 text-amber-800'
      }`}
    >
      <span className="material-symbols-outlined text-[16px]">timer</span>
      {formatted} remaining
    </span>
  );
}

function getSecondsLeft(deadline) {
  if (!deadline) return 0;
  const deadlineMs = new Date(deadline + (deadline.endsWith('Z') ? '' : 'Z')).getTime();
  const nowMs = Date.now();
  return Math.max(0, Math.floor((deadlineMs - nowMs) / 1000));
}
