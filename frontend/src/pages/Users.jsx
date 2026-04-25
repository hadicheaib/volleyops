import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { useToast } from '../context/ToastContext'

const ROLE_TABS = [
  { id: 'player',          label: 'Players',           icon: '🏐' },
  { id: 'coach',           label: 'Head Coaches',       icon: '🎽' },
  { id: 'assistant_coach', label: 'Assistant Coaches',  icon: '📋' },
]


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

const PAGE_SIZE = 20

function Pagination({ page, total, pageSize, onChange }) {
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
      <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ Prev</button>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page} of {pages}</span>
      <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next ›</button>
    </div>
  )
}

export default function Users() {
  const toast = useToast()
  const [tab,          setTab]          = useState('player')
  const [users,        setUsers]        = useState([])
  const [players,      setPlayers]      = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [working,      setWorking]      = useState(null)
  const [teamRequests, setTeamRequests] = useState([])
  const [reqLoading,   setReqLoading]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'player') {
        const { data } = await api.get('/players', { params: { limit: PAGE_SIZE, page, search: search || undefined } })
        setPlayers(data.players || [])
        setTotal(data.total || 0)
        setUsers([])
      } else {
        const { data } = await api.get('/users', { params: { role: tab, limit: PAGE_SIZE, page, search: search || undefined } })
        setUsers(data.users || [])
        setTotal(data.total || 0)
        setPlayers([])
      }
    } catch { toast('Failed to load users', 'error') }
    finally { setLoading(false) }
  }, [tab, search, page])

  useEffect(() => { load() }, [load])

  // Load pending team requests (for coach tabs)
  useEffect(() => {
    if (tab === 'coach' || tab === 'assistant_coach') {
      setReqLoading(true)
      api.get('/team-requests', { params: { status: 'pending' } })
        .then(({ data }) => setTeamRequests(data.requests || []))
        .catch(() => {})
        .finally(() => setReqLoading(false))
    }
  }, [tab])

  async function toggleActive(u) {
    setWorking(u.id)
    try {
      await api.put(`/users/${u.id}`, { is_active: !u.is_active })
      toast(`${u.name} ${u.is_active ? 'deactivated' : 'activated'}`, 'success')
      load()
    } catch { toast('Failed to update', 'error') }
    finally { setWorking(null) }
  }

  async function promoteToAdmin(u) {
    if (!u.id) { toast('Cannot promote — user account not linked', 'error'); return }
    if (!window.confirm(`Promote ${u.name} to Admin? This grants full system access.`)) return
    setWorking(u.id)
    try {
      await api.put(`/users/${u.id}`, { role: 'admin' })
      toast(`${u.name} promoted to Admin`, 'success')
      load()
    } catch { toast('Failed to promote', 'error') }
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

  async function handleTeamRequest(id, action) {
    setWorking(id)
    try {
      await api.patch(`/team-requests/${id}`, { action })
      toast(`Request ${action}d`, 'success')
      setTeamRequests(r => r.filter(x => x.id !== id))
      load()
    } catch (err) {
      toast(err.response?.data?.error || 'Failed', 'error')
    } finally { setWorking(null) }
  }

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
          <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); setPage(1) }}
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
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </div>

      {/* Pending team requests panel (coach/asst_coach tabs) */}
      {(tab === 'coach' || tab === 'assistant_coach') && reqLoading && (
        <div className="loading-center" style={{ marginBottom: 16 }}><div className="spinner" /></div>
      )}
      {(tab === 'coach' || tab === 'assistant_coach') && !reqLoading && teamRequests.length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(245,158,11,.3)' }}>
          <div className="card-header" style={{ marginBottom: 12 }}>
            <div>
              <div className="card-title">⏳ Pending Team Requests ({teamRequests.length})</div>
              <div className="card-sub">These coaches are waiting to be approved and assigned to their team</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {teamRequests.filter(r => r.user_role === tab).map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface2)', borderRadius: 10, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{r.user_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.user_email} · wants to join <strong>{r.team_name}</strong></div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-green btn-sm" disabled={working === r.id}
                    onClick={() => handleTeamRequest(r.id, 'approve')}>Approve</button>
                  <button className="btn btn-pink btn-sm" disabled={working === r.id}
                    onClick={() => handleTeamRequest(r.id, 'reject')}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <>
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
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                          <button disabled={working === p.id} onClick={() => promoteToAdmin({ id: p.user_id, name: p.name })}
                            style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(124,58,237,.3)', background: 'rgba(124,58,237,.08)', color: 'var(--purple-light)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            → Admin
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
            </>
          )}
        </div>

      ) : (

        /* ── Coaches / Asst Coaches table ── */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {users.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">{currentTab?.icon}</div><p>No {currentTab?.label.toLowerCase()} found</p></div>
          ) : (
            <>
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
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button disabled={working === u.id} onClick={() => toggleActive(u)}
                            style={{
                              padding: '3px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              border: u.is_active ? '1px solid rgba(236,72,153,.3)' : '1px solid rgba(16,185,129,.4)',
                              background: u.is_active ? 'rgba(236,72,153,.08)' : 'rgba(16,185,129,.1)',
                              color: u.is_active ? 'var(--pink)' : '#10b981',
                            }}>
                            {working === u.id ? '…' : u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button disabled={working === u.id} onClick={() => promoteToAdmin(u)}
                            style={{ padding: '3px 12px', borderRadius: 6, border: '1px solid rgba(124,58,237,.3)', background: 'rgba(124,58,237,.08)', color: 'var(--purple-light)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            → Admin
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
