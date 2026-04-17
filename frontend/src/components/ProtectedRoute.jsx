import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const STATUS_CONFIG = {
  pending: {
    icon: '⏳',
    title: 'Application Under Review',
    message: 'Your registration has been received. The club admin is reviewing your application. You\'ll have full access once approved.',
    color: 'var(--yellow)',
    badge: 'Pending Review',
  },
  waitlisted: {
    icon: '📋',
    title: 'You\'re on the Waitlist',
    message: 'You\'ve been placed on the waitlist. We\'ll notify you as soon as a spot opens up on the roster.',
    color: 'var(--cyan)',
    badge: 'Waitlisted',
  },
  rejected: {
    icon: '❌',
    title: 'Application Not Approved',
    message: 'Unfortunately your application was not approved at this time. Please contact the club admin for more information.',
    color: 'var(--pink)',
    badge: 'Not Approved',
  },
  staff_pending: {
    icon: '⏳',
    title: 'Account Pending Approval',
    message: 'Your coaching staff account has been created and is awaiting admin activation. You\'ll have full access once approved.',
    color: 'var(--cyan)',
    badge: 'Awaiting Activation',
  },
}

function PendingScreen({ status, user, onLogout }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, flexDirection: 'column', gap: 0,
    }}>
      {/* Top bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 56, background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
      }}>
        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 18, background: 'var(--grad1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          VolleyOps
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user?.name}</span>
          <button
            onClick={onLogout}
            style={{ fontSize: 12, padding: '5px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Card */}
      <div style={{
        maxWidth: 480, width: '100%', textAlign: 'center',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '48px 40px',
        boxShadow: '0 8px 40px rgba(0,0,0,.35)',
      }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>{cfg.icon}</div>

        <span style={{
          display: 'inline-block', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: '4px 12px', borderRadius: 20,
          background: `${cfg.color}22`, color: cfg.color,
          border: `1px solid ${cfg.color}55`, marginBottom: 16,
        }}>
          {cfg.badge}
        </span>

        <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'var(--text)', marginBottom: 12 }}>
          {cfg.title}
        </h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: 14, marginBottom: 28 }}>
          {cfg.message}
        </p>

        {/* What happens next — for pending player or pending staff */}
        {(status === 'pending' || status === 'staff_pending') && (
          <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: '16px 20px', textAlign: 'left', marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              What happens next?
            </div>
            {[
              ['📝', 'Admin reviews your registration'],
              ['✅', 'You get notified of the decision'],
              ['🏐', 'Once approved, full access is granted'],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-muted)', marginBottom: 7 }}>
                <span style={{ fontSize: 16 }}>{icon}</span> {text}
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          Questions? Contact the club admin at{' '}
          <span style={{ color: 'var(--purple-light)' }}>admin@volleyops.com</span>
        </p>
      </div>
    </div>
  )
}

export default function ProtectedRoute() {
  const { user, loading, isApproved, isPlayer, isCoach, isAssistant, playerStatus, logout } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (!isApproved) {
    // Determine which pending screen to show based on role
    const pendingStatus = isPlayer
      ? (playerStatus ?? 'pending')
      : (isCoach || isAssistant) ? 'staff_pending' : 'pending'
    return <PendingScreen status={pendingStatus} user={user} onLogout={logout} />
  }

  return <Outlet />
}
