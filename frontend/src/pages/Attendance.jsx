import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { useToast } from '../context/ToastContext'

const STATUS_COLORS = {
  present: 'var(--green)',
  late:    '#f59e0b',
  absent:  'var(--pink)',
  excused: 'var(--cyan)',
}
const STATUS_OPTS = ['present','absent','late','excused']
const TYPE_LABELS = { training: 'Training', match: 'Match', tournament: 'Tournament', other: 'Other' }

// ── Create Session Modal ──────────────────────────────────────────────────────
function CreateSessionModal({ teams, onClose, onCreated }) {
  const toast = useToast()
  const [form, setForm] = useState({ team_id: teams[0]?.id || '', date: '', type: 'training', title: '', notes: '' })
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/attendance/sessions', { ...form, team_id: Number(form.team_id) })
      toast('Session created', 'success')
      onCreated()
      onClose()
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to create session', 'error')
    } finally { setLoading(false) }
  }

  const f = field => ({ value: form[field], onChange: e => setForm(s => ({ ...s, [field]: e.target.value })) })

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <span className="modal-title">New Training Session</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-row"><label>Team *</label>
            <select className="input" required {...f('team_id')}>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="form-grid">
            <div className="form-row"><label>Date *</label>
              <input className="input" type="datetime-local" required {...f('date')} />
            </div>
            <div className="form-row"><label>Type</label>
              <select className="input" {...f('type')}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row"><label>Title</label>
            <input className="input" placeholder="e.g. Monday Practice" {...f('title')} />
          </div>
          <div className="form-row"><label>Notes</label>
            <textarea className="input" rows={2} placeholder="Optional…" {...f('notes')} />
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Mark Attendance Modal ─────────────────────────────────────────────────────
function MarkAttendanceModal({ session, onClose, onMarked }) {
  const toast = useToast()
  const [detail, setDetail]   = useState(null)
  const [roster, setRoster]   = useState([])
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    api.get(`/attendance/sessions/${session.id}`)
      .then(({ data }) => {
        setDetail(data.session)
        setRoster(data.roster.map(r => ({ ...r, _status: r.status || 'present' })))
      })
      .catch(() => toast('Failed to load session', 'error'))
  }, [session.id])

  function setStatus(playerId, status) {
    setRoster(prev => prev.map(r => r.player_id === playerId ? { ...r, _status: status } : r))
  }

  function markAll(status) {
    setRoster(prev => prev.map(r => ({ ...r, _status: status })))
  }

  async function save() {
    setSaving(true)
    try {
      const records = roster.map(r => ({ player_id: r.player_id, status: r._status }))
      await api.post(`/attendance/sessions/${session.id}/mark`, { records })
      toast(`Attendance saved for ${records.length} players`, 'success')
      onMarked()
      onClose()
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to save', 'error')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div>
            <span className="modal-title">
              {detail?.title || TYPE_LABELS[session.type]} — {new Date(session.date).toLocaleDateString()}
            </span>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{session.team_name}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Quick mark-all */}
        <div style={{ padding: '8px 0', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>Mark all:</span>
          {STATUS_OPTS.map(s => (
            <button key={s} type="button" className="btn btn-secondary btn-sm" onClick={() => markAll(s)}
              style={{ borderColor: STATUS_COLORS[s], color: STATUS_COLORS[s] }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, borderTop: '1px solid var(--border)' }}>
          {!detail ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : roster.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No active players on this team's roster.
            </div>
          ) : roster.map(r => (
            <div key={r.player_id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.player_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {r.position || ''}{r.jersey_number ? ` · #${r.jersey_number}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {STATUS_OPTS.map(s => (
                  <button key={s} type="button" onClick={() => setStatus(r.player_id, s)}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .1s',
                      border: `1.5px solid`,
                      borderColor: r._status === s ? STATUS_COLORS[s] : 'var(--border)',
                      background: r._status === s ? `${STATUS_COLORS[s]}20` : 'var(--surface2)',
                      color: r._status === s ? STATUS_COLORS[s] : 'var(--text-dim)',
                    }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 0 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !detail}>
            {saving ? 'Saving…' : `Save Attendance (${roster.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Summary Table ─────────────────────────────────────────────────────────────
function SummaryTab({ teamId }) {
  const toast = useToast()
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!teamId) return
    setLoading(true)
    api.get('/attendance/summary', { params: { team_id: teamId } })
      .then(({ data }) => setSummary(data.summary || []))
      .catch(() => toast('Failed to load summary', 'error'))
      .finally(() => setLoading(false))
  }, [teamId])

  if (!teamId) return (
    <div className="empty-state"><div className="empty-icon">📅</div><p>Select a team to view attendance summary.</p></div>
  )

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  if (summary.length === 0) return (
    <div className="empty-state"><div className="empty-icon">📅</div><p>No attendance records yet for this team.</p></div>
  )

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            {['Player','Pos','Sessions','Present','Late','Absent','Excused','Rate'].map(h => (
              <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summary.map(p => {
            const rate = p.rate
            const color = rate == null ? 'var(--text-dim)' : rate >= 80 ? 'var(--green)' : rate >= 60 ? '#f59e0b' : 'var(--pink)'
            return (
              <tr key={p.player_id} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{p.player_name}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{p.position || '—'}</td>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>{p.total_sessions}</td>
                <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--green)' }}>{p.present}</td>
                <td style={{ padding: '10px 14px', fontSize: 13, color: '#f59e0b' }}>{p.late}</td>
                <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--pink)' }}>{p.absent}</td>
                <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--cyan)' }}>{p.excused}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 60, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                      {rate != null && <div style={{ width: `${rate}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .3s' }} />}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color, minWidth: 36 }}>
                      {rate != null ? `${rate}%` : '—'}
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Attendance() {
  const toast = useToast()
  const [teams,    setTeams]    = useState([])
  const [sessions, setSessions] = useState([])
  const [selTeam,  setSelTeam]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [tab,      setTab]      = useState('sessions') // 'sessions' | 'summary'
  const [showCreate, setShowCreate] = useState(false)
  const [markTarget, setMarkTarget] = useState(null)  // session to mark

  useEffect(() => {
    api.get('/teams').then(({ data }) => {
      const t = data.teams || []
      setTeams(t)
      if (t.length) setSelTeam(String(t[0].id))
    }).catch(() => {})
  }, [])

  const loadSessions = useCallback(async () => {
    if (!selTeam) return
    setLoading(true)
    try {
      const { data } = await api.get('/attendance/sessions', { params: { team_id: selTeam } })
      setSessions(data.sessions || [])
    } catch { toast('Failed to load sessions', 'error') }
    finally { setLoading(false) }
  }, [selTeam])

  useEffect(() => { loadSessions() }, [loadSessions])

  const selTeamObj = teams.find(t => String(t.id) === selTeam)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Attendance Tracking</div>
          <div className="page-subtitle">Track player attendance for training sessions and matches</div>
        </div>
        {tab === 'sessions' && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Session</button>
        )}
      </div>

      {/* Team selector + tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="input" style={{ width: 220 }} value={selTeam} onChange={e => setSelTeam(e.target.value)}>
          <option value="">— Select team —</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['sessions','Sessions'],['summary','Summary']].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: '1.5px solid', transition: 'all .15s',
                background: tab === v ? 'rgba(124,58,237,.1)' : 'var(--surface)',
                borderColor: tab === v ? 'var(--purple)' : 'var(--border)',
                color: tab === v ? 'var(--purple-light)' : 'var(--text)',
              }}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── Sessions tab ── */}
      {tab === 'sessions' && (
        !selTeam ? (
          <div className="empty-state"><div className="empty-icon">📅</div><p>Select a team to view sessions.</p></div>
        ) : loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <p>No sessions yet. Create one to start tracking attendance.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sessions.map(s => {
              const markedPct = s.roster_size > 0 ? Math.round((s.marked_count / s.roster_size) * 100) : 0
              const presentPct = s.roster_size > 0 ? Math.round((s.present_count / s.roster_size) * 100) : 0
              return (
                <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
                      {s.title || TYPE_LABELS[s.type] || 'Session'}
                      <span className="badge badge-dim" style={{ fontSize: 10 }}>{TYPE_LABELS[s.type]}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      {s.team_name && ` · ${s.team_name}`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 20, textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>{s.present_count}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Present</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-muted)' }}>{s.roster_size}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Roster</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ width: 60, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
                        <div style={{ width: `${markedPct}%`, height: '100%', background: markedPct === 100 ? 'var(--green)' : 'var(--purple)', borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>{markedPct}% marked</div>
                    </div>
                  </div>

                  <button className="btn btn-primary btn-sm" onClick={() => setMarkTarget(s)}>
                    Mark Attendance
                  </button>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ── Summary tab ── */}
      {tab === 'summary' && (
        <SummaryTab teamId={selTeam ? Number(selTeam) : null} />
      )}

      {showCreate && (
        <CreateSessionModal
          teams={selTeamObj ? [selTeamObj] : teams}
          onClose={() => setShowCreate(false)}
          onCreated={loadSessions}
        />
      )}
      {markTarget && (
        <MarkAttendanceModal
          session={markTarget}
          onClose={() => setMarkTarget(null)}
          onMarked={loadSessions}
        />
      )}
    </div>
  )
}
