import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import api from '../api/client'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { socket }       = useSocket()
  const navigate         = useNavigate()
  const [notifs, setNotifs]       = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [showMenu, setShowMenu]   = useState(false)
  const bellRef = useRef(null)

  useEffect(() => {
    api.get('/notifications?is_read=false&limit=10')
      .then(({ data }) => setNotifs(data.notifications || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!socket) return
    const handler = (n) => setNotifs((prev) => [n, ...prev].slice(0, 10))
    socket.on('notification', handler)
    return () => socket.off('notification', handler)
  }, [socket])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setShowNotifs(false)
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function markRead(id) {
    api.patch(`/notifications/${id}/read`).catch(() => {})
    setNotifs((prev) => prev.filter((n) => n.id !== id))
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const ROLE_LABELS = { admin: 'Admin', coach: 'Coach', assistant_coach: 'Asst. Coach', player: 'Player' }

  return (
    <nav className="topnav">
      <Link to="/dashboard" className="topnav-logo">
        <div className="topnav-logo-icon">🏐</div>
        VolleyOps
      </Link>

      <div className="topnav-right" ref={bellRef}>
        {/* Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowNotifs((v) => !v); setShowMenu(false) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, position: 'relative', padding: '4px 8px' }}
          >
            🔔
            {notifs.length > 0 && (
              <span style={{
                position: 'absolute', top: 0, right: 0, background: 'var(--pink)',
                color: '#fff', fontSize: 10, fontWeight: 700,
                width: 16, height: 16, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {notifs.length > 9 ? '9+' : notifs.length}
              </span>
            )}
          </button>

          {showNotifs && (
            <div style={{
              position: 'absolute', right: 0, top: '110%', width: 320,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, zIndex: 200, overflow: 'hidden',
              boxShadow: '0 12px 32px rgba(0,0,0,.4)',
            }}>
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
                {notifs.length > 0 && (
                  <button onClick={() => { api.post('/notifications/read-all'); setNotifs([]) }}
                    style={{ background: 'none', border: 'none', color: 'var(--purple-light)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    Mark all read
                  </button>
                )}
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {notifs.length === 0 ? (
                  <p style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>All caught up 🎉</p>
                ) : notifs.map((n) => (
                  <div key={n.id} onClick={() => markRead(n.id)} style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', transition: 'background .15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = ''}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{n.body}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Role badge */}
        <span className="role-badge">{ROLE_LABELS[user?.role] || user?.role}</span>

        {/* User menu */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => { setShowMenu((v) => !v); setShowNotifs(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#0a0a0f', fontWeight: 600, fontSize: 13 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            {user?.name?.split(' ')[0]}
          </button>

          {showMenu && (
            <div style={{
              position: 'absolute', right: 0, top: '110%', width: 180,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, zIndex: 200, overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,.3)',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.email}</div>
              </div>
              <Link to="/profile" onClick={() => setShowMenu(false)} style={{
                display: 'block', width: '100%', padding: '10px 16px',
                color: 'var(--text-muted)', fontWeight: 500, fontSize: 13,
                textDecoration: 'none', borderBottom: '1px solid var(--border)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
                ⚙️ My Profile
              </Link>
              <button onClick={handleLogout} style={{
                width: '100%', padding: '10px 16px', background: 'none',
                border: 'none', cursor: 'pointer', color: 'var(--pink)',
                fontWeight: 600, fontSize: 13, textAlign: 'left', fontFamily: 'DM Sans, sans-serif',
              }}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
