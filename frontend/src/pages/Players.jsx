import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const STATUS_OPTS = ['', 'pending', 'approved', 'rejected', 'waitlisted']
const POSITION_LABELS = {
  setter: 'Setter', libero: 'Libero', outside_hitter: 'Outside Hitter',
  opposite: 'Opposite', middle_blocker: 'Middle Blocker', defensive_specialist: 'Def. Specialist',
}
const STATUS_BADGE = {
  pending:    'badge-yellow',
  approved:   'badge-green',
  rejected:   'badge-pink',
  waitlisted: 'badge-cyan',
}

export default function Players() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [players,  setPlayers]  = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [filters,  setFilters]  = useState({ status: 'pending', search: '', page: 1 })
  const [selected, setSelected] = useState(null)   // player id for detail panel
  const [working,  setWorking]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 50, page: filters.page }
      if (filters.status) params.status = filters.status
      if (filters.search) params.search = filters.search
      const { data } = await api.get('/players', { params })
      setPlayers(data.players || [])
      setTotal(data.total || 0)
    } catch { toast('Failed to load players', 'error') }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { load() }, [load])

  async function updateStatus(id, status) {
    setWorking(true)
    try {
      await api.patch(`/players/${id}/status`, { status })
      toast(`Player ${status}`, 'success')
      load()
      setSelected(null)
    } catch { toast('Failed to update status', 'error') }
    finally { setWorking(false) }
  }

  const selectedPlayer = players.find((p) => p.id === selected)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Player Registrations</div>
          <div className="page-subtitle">{total} total · manage registration status and team assignments</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-row">
        {STATUS_OPTS.map((s) => (
          <button key={s || 'all'} className={`filter-btn ${filters.status === s ? 'active' : ''}`}
            onClick={() => setFilters((f) => ({ ...f, status: s, page: 1 }))}>
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
        <div className="search-wrap" style={{ marginLeft: 'auto' }}>
          <input className="search-input" placeholder="Search players…" value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Table */}
        <div className="card" style={{ flex: 1 }}>
          {loading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : players.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p>No players found</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Position</th>
                    <th>Team</th>
                    <th>Season</th>
                    <th>Status</th>
                    {isAdmin && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(p.id)}>
                      <td>
                        <div className="cell-name">
                          <div className="avatar">{p.name.charAt(0)}</div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{POSITION_LABELS[p.position] || <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                      <td>{p.team_name || <span style={{ color: 'var(--text-dim)' }}>Unassigned</span>}</td>
                      <td>{p.season || '—'}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[p.registration_status] || 'badge-dim'}`}>
                          {p.registration_status}
                        </span>
                      </td>
                      {isAdmin && (
                        <td onClick={(e) => e.stopPropagation()}>
                          {p.registration_status === 'pending' && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-green btn-sm" disabled={working}
                                onClick={() => updateStatus(p.id, 'approved')}>Approve</button>
                              <button className="btn btn-pink btn-sm" disabled={working}
                                onClick={() => updateStatus(p.id, 'rejected')}>Reject</button>
                              <button className="btn btn-yellow btn-sm" disabled={working}
                                onClick={() => updateStatus(p.id, 'waitlisted')}>Waitlist</button>
                            </div>
                          )}
                          {p.registration_status !== 'pending' && (
                            <button className="btn btn-secondary btn-sm" disabled={working}
                              onClick={() => updateStatus(p.id, 'pending')}>Reset</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedPlayer && (
          <div className="card" style={{ width: 260, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Player Detail</span>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--grad1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 auto 8px' }}>
                {selectedPlayer.name.charAt(0)}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedPlayer.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedPlayer.email}</div>
            </div>
            {[
              ['Phone',    selectedPlayer.phone],
              ['DOB',      selectedPlayer.date_of_birth],
              ['Position', POSITION_LABELS[selectedPlayer.position]],
              ['Jersey',   selectedPlayer.jersey_number != null ? `#${selectedPlayer.jersey_number}` : null],
              ['Season',   selectedPlayer.season],
              ['Team',     selectedPlayer.team_name],
            ].map(([label, val]) => val ? (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{val}</span>
              </div>
            ) : null)}
            {selectedPlayer.notes && (
              <div style={{ marginTop: 12, background: 'var(--surface2)', borderRadius: 8, padding: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {selectedPlayer.notes}
              </div>
            )}
            {isAdmin && selectedPlayer.registration_status === 'pending' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                <button className="btn btn-green" disabled={working} onClick={() => updateStatus(selectedPlayer.id, 'approved')} style={{ justifyContent: 'center' }}>✓ Approve</button>
                <button className="btn btn-yellow" disabled={working} onClick={() => updateStatus(selectedPlayer.id, 'waitlisted')} style={{ justifyContent: 'center' }}>⏳ Waitlist</button>
                <button className="btn btn-pink" disabled={working} onClick={() => updateStatus(selectedPlayer.id, 'rejected')} style={{ justifyContent: 'center' }}>✕ Reject</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
