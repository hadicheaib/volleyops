import { useState, useEffect } from 'react'
import api from '../api/client'
import { useToast } from '../context/ToastContext'

const CONFIDENCE_STYLE = {
  high:   { badge: 'badge-green', label: 'High' },
  medium: { badge: 'badge-cyan',  label: 'Medium' },
  low:    { badge: 'badge-dim',   label: 'Low' },
}

const POS_LABELS = {
  setter: 'Setter', libero: 'Libero', outside_hitter: 'OH',
  opposite: 'OPP', middle_blocker: 'MB', defensive_specialist: 'DS',
}

export default function AIPlacement() {
  const toast = useToast()
  const [tryouts,    setTryouts]    = useState([])
  const [teams,      setTeams]      = useState([])
  const [selTryout,  setSelTryout]  = useState('')
  const [selTeams,   setSelTeams]   = useState([])    // array of team ids
  const [placements, setPlacements] = useState(null)  // null = not run yet
  const [source,     setSource]     = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [applying,   setApplying]   = useState(null)  // player_id being applied
  const [applied,    setApplied]    = useState(new Set())

  useEffect(() => {
    Promise.all([api.get('/tryouts'), api.get('/teams')]).then(([t, tm]) => {
      setTryouts(t.data.tryouts || [])
      setTeams(tm.data.teams || [])
    }).catch(() => {})
  }, [])

  function toggleTeam(id) {
    setSelTeams(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function generate() {
    if (!selTryout) { toast('Please select a tryout first', 'error'); return }
    setLoading(true)
    setPlacements(null)
    setApplied(new Set())
    try {
      const payload = { tryout_id: Number(selTryout) }
      if (selTeams.length) payload.team_ids = selTeams
      const { data } = await api.post('/ai/team-placement', payload)
      setPlacements(data.placements || [])
      setSource(data.source)
      if (!data.placements?.length) toast('No players with evaluations found for this tryout', 'error')
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to generate placements', 'error')
    } finally { setLoading(false) }
  }

  async function applyPlacement(pl) {
    if (!pl.suggested_team_id) return
    setApplying(pl.player_id)
    try {
      await api.post(`/teams/${pl.suggested_team_id}/players`, { player_id: pl.player_id })
      setApplied(prev => new Set([...prev, pl.player_id]))
      toast(`${pl.player_name} added to ${pl.suggested_team_name}`, 'success')
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to apply placement', 'error')
    } finally { setApplying(null) }
  }

  const confStyle = c => CONFIDENCE_STYLE[c] || CONFIDENCE_STYLE.low

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">AI Team Placement</div>
          <div className="page-subtitle">
            Use AI to suggest optimal team assignments based on player evaluations
          </div>
        </div>
        {source && (
          <span className={`badge ${source === 'anthropic' ? 'badge-green' : 'badge-dim'}`}>
            {source === 'anthropic' ? '🤖 AI-Powered' : '⚙️ Algorithmic Fallback'}
          </span>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span style={{ fontWeight: 700 }}>Configure Placement Run</span>
        </div>
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <div className="form-row">
            <label>Tryout *</label>
            <select className="input" value={selTryout} onChange={e => setSelTryout(e.target.value)}>
              <option value="">— Select tryout —</option>
              {tryouts.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({new Date(t.date).toLocaleDateString()})</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Teams (leave empty = all teams)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {teams.map(t => (
                <button key={t.id} type="button" onClick={() => toggleTeam(t.id)}
                  style={{
                    padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: '1.5px solid', transition: 'all .15s',
                    background: selTeams.includes(t.id) ? 'rgba(124,58,237,.15)' : 'var(--surface2)',
                    borderColor: selTeams.includes(t.id) ? 'var(--purple)' : 'var(--border)',
                    color: selTeams.includes(t.id) ? 'var(--purple-light)' : 'var(--text)',
                  }}>{t.name}</button>
              ))}
            </div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={loading || !selTryout}
          style={{ minWidth: 200 }}>
          {loading
            ? <><span className="spinner" style={{ width: 14, height: 14, marginRight: 8 }} />Generating…</>
            : '🤖 Generate Suggestions'}
        </button>
      </div>

      {/* ── Results ── */}
      {loading && (
        <div className="loading-center" style={{ height: 200 }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
          <div style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: 14 }}>
            Analyzing player evaluations…
          </div>
        </div>
      )}

      {!loading && placements !== null && placements.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🤖</div>
          <p>No placement suggestions generated. Ensure players have been evaluated for this tryout.</p>
        </div>
      )}

      {!loading && placements && placements.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {placements.length} placement suggestion{placements.length !== 1 ? 's' : ''} generated
            </div>
            <span className={`badge ${source === 'anthropic' ? 'badge-green' : 'badge-dim'}`} style={{ fontSize: 11 }}>
              {source === 'anthropic' ? 'Claude AI' : 'Algorithmic (no API key)'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {placements.map(pl => {
              const cs = confStyle(pl.confidence)
              const isApplied = applied.has(pl.player_id)
              return (
                <div key={pl.player_id} className="card"
                  style={{ borderLeft: `3px solid var(--purple)`, opacity: isApplied ? .6 : 1, transition: 'opacity .2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{pl.player_name}</div>
                      {pl.position && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          {POS_LABELS[pl.position] || pl.position}
                        </div>
                      )}
                    </div>
                    <span className={`badge ${cs.badge}`}>{cs.label} confidence</span>
                  </div>

                  <div style={{
                    background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginBottom: 12,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ fontSize: 20 }}>🏐</span>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Suggested Team</div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--purple-light)' }}>
                        {pl.suggested_team_name || 'Unassigned'}
                      </div>
                    </div>
                  </div>

                  {pl.reasoning && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5, fontStyle: 'italic' }}>
                      "{pl.reasoning}"
                    </div>
                  )}

                  {pl.suggested_team_id && (
                    <button
                      className={`btn ${isApplied ? 'btn-secondary' : 'btn-primary'}`}
                      style={{ width: '100%' }}
                      disabled={applying === pl.player_id || isApplied}
                      onClick={() => applyPlacement(pl)}
                    >
                      {applying === pl.player_id ? 'Applying…' : isApplied ? '✓ Applied' : 'Apply Placement'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
