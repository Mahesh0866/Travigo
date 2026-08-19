/**
 * StatusBadge — colored pill badge for booking and package statuses.
 */
const STATUS_STYLES = {
  // Booking statuses
  PENDING_ADMIN_APPROVAL: 'bg-purple-100 text-purple-800 border border-purple-300',
  APPROVED:               'bg-teal-100 text-teal-800 border border-teal-300',
  REJECTED:               'bg-rose-100 text-rose-800 border border-rose-300',
  PENDING_PAYMENT:        'bg-amber-100 text-amber-800 border border-amber-300',
  PAYMENT_VERIFICATION:   'bg-blue-100 text-blue-800 border border-blue-300',
  CONFIRMED:              'bg-emerald-100 text-emerald-800 border border-emerald-300',
  CANCELLED:              'bg-red-100 text-red-800 border border-red-300',
  EXPIRED:                'bg-gray-100 text-gray-600 border border-gray-300',
  // Package statuses
  ACTIVE:                 'bg-emerald-100 text-emerald-800 border border-emerald-300',
  INACTIVE:               'bg-amber-100 text-amber-800 border border-amber-300',
};

const STATUS_LABELS = {
  PENDING_ADMIN_APPROVAL: '⏳ Pending Admin Approval',
  APPROVED:               '👍 Approved (Pay Now)',
  REJECTED:               '🚫 Rejected by Admin',
  PENDING_PAYMENT:        '⏳ Pending Payment',
  PAYMENT_VERIFICATION:   '🔍 Verifying UPI',
  CONFIRMED:              '✅ Confirmed',
  CANCELLED:              '❌ Cancelled',
  EXPIRED:                '🕐 Expired',
  ACTIVE:                 '✅ Active',
  INACTIVE:               '⏸ Inactive',
};

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-600 border border-gray-300';
  const label = STATUS_LABELS[status] || status;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}
