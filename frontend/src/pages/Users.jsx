import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { useToast } from '../context/ToastContext'

const ROLE_TABS = [
  { id: 'player',          label: 'Players',           icon: '🏐' },
  { id: 'coach',           label: 'Head Coaches',       icon: '🎽' },
  { id: 'assistant_coach', label: 'Assistant Coaches',  icon: '📋' },
]

const STATUS_BADGE = {
  1: { cls: 'badge-green', label: 'Active' },
  0: { cls: 'badge-yellow', label: 'Pending' },
}

const REG_BADGE = {
  approved:   'badge-green',
  pending:    'badge-yellow',
  rejected:   'badge-pink',
  waitlisted: 'badge-cyan',
}

const POS_LABELS = {
  setter: 'Setter', libero: 'Libero', outside_hitter: 'Outside Hitter',
  opposite: 'Opposite', middle_blocker: 'Middle Blocker', defensive_specialist: 'Def. Specialist',
}

export default function Users() {
  const toast = useToast()
  const [tab,      setTab]      = useState('player')
  const [users,    setUsers]    = useState([])
  const [players,  setPlayers]  = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [working,  setWorking]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'player') {
        const { data } = await api.get('/players', { params: { limit: 100, search: search || undefined } })
        setPlayers(data.players || [])
        setTotal(data.total || 0)
        setUsers([])
      } else {
        const { data } = await api.get('/users', { params: { role: tab, limit: 100, search: search || undefined } })
        setUsers(data.users || [])
        setTotal(data.total || 0)
        setPlayers([])
      }
    } catch { toast('Failed to load users', 'error') }
    finally { setLoading(false) }
  }, [tab, search])

  useEffect(() => { load() }, [load])

  async function toggleActive(u) {
    setWorking(u.id)
    try {
      await api.put(`/users/${u.id}`, { is_active: !u.is_active })
      toast(`${u.name} ${u.is_active ? 'deactivated' : 'activated'}`, 'success')
      load()
    } catch { toast('Failed to update', 'error') }
    finally { setWorking(null) }
  }

  async function updatePlayerStatus(id, status) {
    setWorking(id)
    try {
      await api.patch(`/players/${id}/status`, { status })
      toast(`Status updated to ${status}`, 'success')
      load()
    } catch { toast('Failed to update', 'error') }
    finally { setWorking(null) }
  }

  const counts = { player: null, coach: null, assistant_coach: null }
  const currentTab = ROLE_TABS.find(t => t.id === tab)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">User Management</div>
          <div className="page-subtitle">View and manage all users by role</div>
        </div>
      </div>

      {/* Role tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {ROLE_TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch('') }}
            style={{
              padding: '8px 20px', borderRadius: 10, border: '1.5px solid', cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600,
              transition: 'all .15s',
              background: tab === t.id ? 'rgba(124,58,237,.1)' : 'var(--surface)',
              borderColor: tab === t.id ? 'var(--purple)' : 'var(--border)',
              color: tab === t.id ? 'var(--purple-light)' : 'var(--text)',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
        <div className="search-wrap" style={{ marginLeft: 'auto' }}>
          <input className="search-input" placeholder={`Search ${currentTab?.label.toLowerCase()}…`}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Total count */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 600 }}>
        {total} {currentTab?.label.toLowerCase()} total
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : tab === 'player' ? (

        /* ── Players table ── */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {players.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🏐</div><p>No players found</p></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['Player', 'Position', 'Team', 'Jersey', 'Season', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '12px 16px' }}>
                      <div className="cell-name">
                        <div className="avatar">{p.name.charAt(0)}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12 }}>{POS_LABELS[p.position] || <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12 }}>{p.team_name || <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12 }}>{p.jersey_number != null ? `#${p.jersey_number}` : <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12 }}>{p.season || <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge ${REG_BADGE[p.registration_status] || 'badge-dim'}`}>{p.registration_status}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {p.registration_status === 'pending' && (
                          <>
                            <button disabled={working === p.id} onClick={() => updatePlayerStatus(p.id, 'approved')}
                              style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(16,185,129,.4)', background: 'rgba(16,185,129,.1)', color: '#10b981', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                              Approve
                            </button>
                            <button disabled={working === p.id} onClick={() => updatePlayerStatus(p.id, 'rejected')}
                              style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(236,72,153,.3)', background: 'rgba(236,72,153,.08)', color: 'var(--pink)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                              Reject
                            </button>
                          </>
                        )}
                        {p.registration_status === 'approved' && (
                          <button disabled={working === p.id} onClick={() => updatePlayerStatus(p.id, 'waitlisted')}
                            style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            Waitlist
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      ) : (

        /* ── Coaches / Asst Coaches table ── */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {users.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">{currentTab?.icon}</div><p>No {currentTab?.label.toLowerCase()} found</p></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['Name', 'Email', 'Team', 'Account Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '12px 16px' }}>
                      <div className="cell-name">
                        <div className="avatar" style={{ background: tab === 'coach' ? 'rgba(124,58,237,.2)' : 'rgba(6,182,212,.2)', color: tab === 'coach' ? 'var(--purple-light)' : 'var(--cyan)' }}>{u.name.charAt(0)}</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12 }}>
                      {u.requested_team_name
                        ? <span>
                            {u.requested_team_name}
                            {u.requested_team_status === 'pending' && (
                              <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 5, background: 'rgba(6,182,212,.12)', color: 'var(--cyan)' }}>pending</span>
                            )}
                          </span>
                        : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge ${u.is_active ? 'badge-green' : 'badge-yellow'}`}>
                        {u.is_active ? 'Active' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button disabled={working === u.id} onClick={() => toggleActive(u)}
                        style={{
                          padding: '3px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          border: u.is_active ? '1px solid rgba(236,72,153,.3)' : '1px solid rgba(16,185,129,.4)',
                          background: u.is_active ? 'rgba(236,72,153,.08)' : 'rgba(16,185,129,.1)',
                          color: u.is_active ? 'var(--pink)' : '#10b981',
                        }}>
                        {working === u.id ? '…' : u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
