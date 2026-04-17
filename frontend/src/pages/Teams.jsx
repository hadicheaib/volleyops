import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const POS_LABELS = {
  setter:'Setter', libero:'Libero', outside_hitter:'Outside Hitter',
  opposite:'Opposite', middle_blocker:'Middle Blocker', defensive_specialist:'Def. Specialist',
}

function CreateTeamModal({ onClose, onCreated }) {
  const toast = useToast()
  const [form, setForm] = useState({ name:'', division:'', season:'', max_players: 14 })
  const [users, setUsers]   = useState([])
  const [coachId, setCoachId] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/users?role=coach').then(({ data }) => setUsers(data.users || [])).catch(() => {})
  }, [])

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/teams', { ...form, coach_id: coachId || null, max_players: Number(form.max_players) })
      toast('Team created', 'success')
      onCreated(data)
    } catch (err) { toast(err.response?.data?.error || 'Failed to create team', 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Create Team</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-row"><label>Team Name *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} placeholder="Cedar Spikers" /></div>
          <div className="form-grid">
            <div className="form-row"><label>Division</label>
              <input className="input" value={form.division} onChange={(e) => setForm(f => ({...f, division: e.target.value}))} placeholder="Division A" /></div>
            <div className="form-row"><label>Season</label>
              <input className="input" value={form.season} onChange={(e) => setForm(f => ({...f, season: e.target.value}))} placeholder="2025-2026" /></div>
          </div>
          <div className="form-grid">
            <div className="form-row"><label>Head Coach</label>
              <select className="select" value={coachId} onChange={(e) => setCoachId(e.target.value)}>
                <option value="">Select coach…</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select></div>
            <div className="form-row"><label>Max Players</label>
              <input className="input" type="number" min="6" max="30" value={form.max_players} onChange={(e) => setForm(f => ({...f, max_players: e.target.value}))} /></div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create Team'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddPlayerModal({ teamId, onClose, onAdded }) {
  const toast = useToast()
  const [players, setPlayers] = useState([])
  const [selected, setSelected] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/players?status=approved&limit=100').then(({ data }) => setPlayers(data.players || [])).catch(() => {})
  }, [])

  const filtered = players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  async function submit() {
    if (!selected.length) return
    setLoading(true)
    try {
      const { data } = await api.post(`/teams/${teamId}/players`, { playerIds: selected })
      toast(`${selected.length} player(s) added`, 'success')
      onAdded(data.roster)
    } catch (err) { toast(err.response?.data?.error || 'Failed to add players', 'error') }
    finally { setLoading(false) }
  }

  function toggle(id) { setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]) }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Add Players to Roster</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <input className="input mb-4" placeholder="Search approved players…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12 }} />
        <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {filtered.map(p => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: selected.includes(p.id) ? 'rgba(124,58,237,.15)' : 'var(--surface2)', borderRadius: 8, cursor: 'pointer', border: `1px solid ${selected.includes(p.id) ? 'var(--purple)' : 'var(--border)'}` }}>
              <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} style={{ accentColor: 'var(--purple)' }} />
              <div className="avatar" style={{ width:24, height:24, fontSize:11 }}>{p.name.charAt(0)}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{POS_LABELS[p.position] || 'No position'}</div>
              </div>
            </label>
          ))}
          {filtered.length === 0 && <p style={{ textAlign:'center', color:'var(--text-dim)', fontSize:13, padding:20 }}>No approved players found</p>}
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!selected.length || loading} onClick={submit}>
            {loading ? 'Adding…' : `Add ${selected.length} Player${selected.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Teams() {
  const { isAdmin, canManage, canManageRoster } = useAuth()
  const toast = useToast()
  const [teams,     setTeams]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [activeTeam, setActiveTeam] = useState(null)
  const [roster,    setRoster]    = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [working,   setWorking]   = useState(false)

  const loadTeams = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/teams')
      setTeams(data.teams || [])
    } catch { toast('Failed to load teams', 'error') }
    finally { setLoading(false) }
  }, [])

  const loadRoster = useCallback(async (id) => {
    const { data } = await api.get(`/teams/${id}`)
    setActiveTeam(data)
    setRoster(data.roster || [])
  }, [])

  useEffect(() => { loadTeams() }, [loadTeams])

  async function removePlayer(playerId) {
    if (!activeTeam) return
    setWorking(true)
    try {
      const { data } = await api.delete(`/teams/${activeTeam.id}/players/${playerId}`)
      setRoster(data.roster)
      toast('Player removed', 'success')
    } catch { toast('Failed to remove player', 'error') }
    finally { setWorking(false) }
  }

  async function toggleFinalize() {
    setWorking(true)
    try {
      const { data } = await api.patch(`/teams/${activeTeam.id}/finalize`, { is_finalized: !activeTeam.is_finalized })
      setActiveTeam(data)
      loadTeams()
      toast(data.is_finalized ? 'Team finalized' : 'Team un-finalized', 'success')
    } catch (err) { toast(err.response?.data?.error || 'Failed', 'error') }
    finally { setWorking(false) }
  }

  async function togglePublish() {
    setWorking(true)
    try {
      const { data } = await api.patch(`/teams/${activeTeam.id}/publish`, { roster_published: !activeTeam.roster_published })
      setActiveTeam(data)
      loadTeams()
      toast(data.roster_published ? 'Roster published! Players notified.' : 'Roster unpublished', 'success')
    } catch (err) { toast(err.response?.data?.error || 'Failed', 'error') }
    finally { setWorking(false) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Team Rosters</div>
          <div className="page-subtitle">{teams.length} team{teams.length !== 1 ? 's' : ''} · assign players, finalize and publish rosters</div>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Create Team</button>}
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Team list */}
        <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? <div className="loading-center"><div className="spinner" /></div> :
           teams.length === 0 ? <div className="empty-state"><div className="empty-icon">👥</div><p>No teams yet</p></div> :
           teams.map((t) => (
            <div key={t.id} onClick={() => loadRoster(t.id)}
              style={{ background: activeTeam?.id === t.id ? 'rgba(124,58,237,.18)' : 'var(--surface)', border: `1px solid ${activeTeam?.id === t.id ? 'var(--purple)' : 'var(--border)'}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'all .15s' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{t.division || '—'} · {t.season || '—'}</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <span className="badge badge-purple">{t.player_count || 0}/{t.max_players}</span>
                {t.roster_published ? <span className="badge badge-green">Published</span> :
                 t.is_finalized     ? <span className="badge badge-cyan">Finalized</span> :
                 <span className="badge badge-dim">Draft</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Roster panel */}
        {activeTeam ? (
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <div>
                <div className="card-title">{activeTeam.name}</div>
                <div className="card-sub">
                  {activeTeam.coach_name && `Coach: ${activeTeam.coach_name}`}
                  {activeTeam.assistant_coach_name && ` · Asst: ${activeTeam.assistant_coach_name}`}
                </div>
              </div>
              {canManage && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {canManageRoster && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowAddPlayer(true)}>+ Add Players</button>
                  )}
                  <button className={`btn btn-sm ${activeTeam.is_finalized ? 'btn-yellow' : 'btn-cyan'}`} disabled={working} onClick={toggleFinalize}>
                    {activeTeam.is_finalized ? '↩ Unfinalize' : '✓ Finalize'}
                  </button>
                  {activeTeam.is_finalized && (
                    <button className={`btn btn-sm ${activeTeam.roster_published ? 'btn-pink' : 'btn-green'}`} disabled={working} onClick={togglePublish}>
                      {activeTeam.roster_published ? 'Unpublish' : '📢 Publish Roster'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Status bar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {activeTeam.roster_published && <span className="badge badge-green">✓ Roster Published</span>}
              {activeTeam.is_finalized && !activeTeam.roster_published && <span className="badge badge-cyan">✓ Finalized – Not Published</span>}
              {!activeTeam.is_finalized && <span className="badge badge-dim">Draft</span>}
              <span className="badge badge-purple">{roster.length}/{activeTeam.max_players} Players</span>
            </div>

            {roster.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <p>No players assigned yet</p>
                {canManageRoster && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowAddPlayer(true)}>Add Players</button>}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Player</th><th>Position</th><th>Jersey</th><th>Status</th>
                      {canManageRoster && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((p, i) => (
                      <tr key={p.id}>
                        <td style={{ color: 'var(--text-dim)', fontSize: 12 }}>{i + 1}</td>
                        <td>
                          <div className="cell-name">
                            <div className="avatar" style={{ background: 'var(--grad1)' }}>{p.name.charAt(0)}</div>
                            <div>
                              <div style={{ fontWeight: 600 }}>{p.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>{POS_LABELS[p.position] || <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                        <td>{p.jersey_number != null ? <span className="badge badge-purple">#{p.jersey_number}</span> : '—'}</td>
                        <td><span className={`badge ${p.registration_status === 'approved' ? 'badge-green' : 'badge-yellow'}`}>{p.registration_status}</span></td>
                        {canManageRoster && (
                          <td>
                            <button className="btn btn-pink btn-sm" disabled={working} onClick={() => removePlayer(p.id)}>Remove</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty-state">
              <div className="empty-icon">👈</div>
              <p>Select a team to view roster</p>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateTeamModal
          onClose={() => setShowCreate(false)}
          onCreated={(t) => { setTeams(prev => [t, ...prev]); setShowCreate(false) }}
        />
      )}
      {showAddPlayer && activeTeam && (
        <AddPlayerModal
          teamId={activeTeam.id}
          onClose={() => setShowAddPlayer(false)}
          onAdded={(newRoster) => { setRoster(newRoster); setShowAddPlayer(false); loadTeams() }}
        />
      )}
    </div>
  )
}
