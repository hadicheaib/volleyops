import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

// ─── Shared helpers ────────────────────────────────────────────────────────────
function fmt(n) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtMoney(n) {
  return '$' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtMonth(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('default', { month: 'short' })
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, value, label, delta, deltaUp, accentColor }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9,
        background: `${accentColor}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 17, marginBottom: 12,
      }}>{icon}</div>
      <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, marginBottom: 4, color: accentColor }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
      {delta && (
        <div style={{
          fontSize: 11.5, fontWeight: 600, marginTop: 8,
          color: deltaUp === true ? 'var(--green)' : deltaUp === false ? 'var(--pink)' : 'var(--text-dim)',
        }}>{delta}</div>
      )}
    </div>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────
function CardHeader({ title, sub, badge, badgeColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      {badge && (
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
          background: `${badgeColor || 'var(--purple)'}22`,
          color: badgeColor || 'var(--purple-light)',
        }}>{badge}</span>
      )}
    </div>
  )
}

// ─── Donut SVG (payment status) ───────────────────────────────────────────────
function DonutChart({ segments }) {
  // segments: [{value, color, label}]
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0)
  if (!total) return <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>No data</div>

  const R = 56, cx = 70, cy = 70, stroke = 22
  let offset = 0
  const circumference = 2 * Math.PI * R

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
        {segments.map((seg, i) => {
          if (!seg.value) return null
          const pct = seg.value / total
          const dash = pct * circumference
          const el = (
            <circle key={i}
              cx={cx} cy={cy} r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset * circumference}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: 'stroke-dasharray .6s' }}
            />
          )
          offset += pct
          return el
        })}
        <text x={cx} y={cy + 5} textAnchor="middle" fill="var(--text)" fontSize={14} fontWeight={800} fontFamily="DM Mono, monospace">
          {Math.round((segments.find(s => s.label === 'Paid')?.value || 0) / total * 100)}%
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.color }} />
            <span style={{ color: 'var(--text-muted)' }}>{seg.label}</span>
            <span style={{ fontWeight: 700, marginLeft: 'auto', fontFamily: 'DM Mono, monospace' }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Attendance bar chart ─────────────────────────────────────────────────────
function AttendanceBarChart({ data }) {
  if (!data?.length) return <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>No session data yet</div>
  const maxSessions = Math.max(...data.map(d => d.sessions || 0), 1)

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 120 }}>
      {data.map((d, i) => {
        const scheduledH = d.sessions > 0 ? (d.sessions / maxSessions) * 100 : 0
        const attendedPct = d.total_marks > 0 ? (d.attended / d.total_marks) * 100 : 0
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 100 }}>
              <div style={{
                flex: 1, background: 'var(--surface3)', borderRadius: '3px 3px 0 0',
                height: `${scheduledH}%`, minHeight: 3,
              }} />
              <div style={{
                flex: 1, background: 'var(--cyan)', borderRadius: '3px 3px 0 0',
                height: `${attendedPct}%`, minHeight: d.attended > 0 ? 3 : 0,
                transition: 'height .6s',
              }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{fmtMonth(d.month)}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Horizontal bar row (registration by team) ───────────────────────────────
function TeamRegBar({ name, count, max }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', width: 120, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
      <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--cyan)', borderRadius: 3, transition: 'width .6s' }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cyan)', fontFamily: 'DM Mono, monospace', width: 28, textAlign: 'right' }}>{count}</div>
    </div>
  )
}

// ─── Win-rate bar ─────────────────────────────────────────────────────────────
function WinRateBar({ pct }) {
  const color = pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--cyan)' : pct >= 30 ? 'var(--yellow)' : 'var(--pink)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'DM Mono, monospace' }}>{pct}%</span>
    </div>
  )
}

// ─── Trend chip (All Teams Performance table) ─────────────────────────────────
function TrendChip({ winRate }) {
  if (winRate >= 70) return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'rgba(16,185,129,.15)', color: 'var(--green)' }}>🔥 Hot</span>
  if (winRate >= 50) return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'rgba(6,182,212,.15)', color: 'var(--cyan)' }}>✓ Good</span>
  if (winRate >= 30) return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'rgba(245,158,11,.15)', color: 'var(--yellow)' }}>→ Stable</span>
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'rgba(236,72,153,.15)', color: 'var(--pink)' }}>↓ Struggling</span>
}

// ─── Risk chip ───────────────────────────────────────────────────────────────
function RiskChip({ risk }) {
  if (risk === 'Low')  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'rgba(16,185,129,.15)', color: 'var(--green)' }}>Low</span>
  if (risk === 'Medium') return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'rgba(245,158,11,.15)', color: 'var(--yellow)' }}>Medium</span>
  if (risk === 'High') return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'rgba(236,72,153,.15)', color: 'var(--pink)' }}>High ⚠️</span>
  return <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>—</span>
}

// ─── ADMIN ANALYTICS VIEW ─────────────────────────────────────────────────────
function AdminView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/analytics/admin')
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading analytics…</div>
  if (error)   return <div style={{ textAlign: 'center', padding: 60, color: 'var(--pink)' }}>{error}</div>

  const { kpi, overdue_alert, payment_status_dist, monthly_attendance, overdue_list, teams_performance, registration_by_team } = data

  const paidSeg   = payment_status_dist?.find(s => s.status === 'paid')
  const pendSeg   = payment_status_dist?.find(s => s.status === 'pending')
  const overSeg   = payment_status_dist?.find(s => s.status === 'overdue')
  const donutSegs = [
    { value: paidSeg?.count || 0, color: 'var(--green)',  label: 'Paid' },
    { value: pendSeg?.count || 0, color: 'var(--yellow)', label: 'Pending' },
    { value: overSeg?.count || 0, color: 'var(--pink)',   label: 'Overdue' },
  ]

  const maxReg = registration_by_team?.length ? Math.max(...registration_by_team.map(r => r.player_count)) : 1

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 28, fontWeight: 800,
          background: 'var(--grad1)', WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>Club Analytics</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Club-wide overview · Admin view
        </div>
      </div>

      {/* Alert banner */}
      {overdue_alert?.count > 0 && (
        <div style={{
          background: 'rgba(236,72,153,.08)', border: '1px solid rgba(236,72,153,.25)',
          borderRadius: 12, padding: '12px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 13,
        }}>
          <span>
            ⚠️ <strong style={{ color: 'var(--pink)' }}>{overdue_alert.count} player{overdue_alert.count !== 1 ? 's' : ''}</strong>
            {' '}overdue on payments —{' '}
            <strong style={{ color: 'var(--pink)' }}>{fmtMoney(overdue_alert.amount)}</strong> outstanding
          </span>
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}>
            Send Reminders
          </button>
        </div>
      )}

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard icon="💰" value={fmtMoney(kpi.total_collected)} label="Total Revenue" accentColor="var(--purple-light)" delta={`of ${fmtMoney(kpi.total_invoiced)} invoiced`} />
        <KpiCard icon="✅" value={`${kpi.payment_pct}%`} label="Payment Completion" accentColor="var(--green)" deltaUp={kpi.payment_pct >= 80} delta={kpi.payment_pct >= 80 ? '▲ On track' : '▼ Needs attention'} />
        <KpiCard icon="📅" value={`${kpi.attendance_pct}%`} label="Club Attendance" accentColor="var(--cyan)" deltaUp={kpi.attendance_pct >= 75} delta={kpi.attendance_pct >= 75 ? '▲ Good participation' : '▼ Below target'} />
        <KpiCard icon="👥" value={fmt(kpi.active_players)} label="Active Players" accentColor="var(--pink)" delta="Registered &amp; approved" />
      </div>

      {/* Row 2: Revenue Breakdown + Donut + Attendance Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Revenue Breakdown */}
        <div className="card" style={{ padding: 22 }}>
          <CardHeader title="Revenue Breakdown" sub="Payment collection summary" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Collected', amount: kpi.total_collected, color: 'var(--green)', pct: kpi.total_invoiced > 0 ? Math.round(kpi.total_collected / kpi.total_invoiced * 100) : 0 },
              { label: 'Pending',   amount: (kpi.total_invoiced - kpi.total_collected - kpi.overdue_amount), color: 'var(--yellow)', pct: kpi.total_invoiced > 0 ? Math.round((kpi.total_invoiced - kpi.total_collected - kpi.overdue_amount) / kpi.total_invoiced * 100) : 0 },
              { label: 'Overdue',   amount: kpi.overdue_amount, color: 'var(--pink)', pct: kpi.total_invoiced > 0 ? Math.round(kpi.overdue_amount / kpi.total_invoiced * 100) : 0 },
            ].map((row, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                  <span style={{ fontWeight: 700, fontFamily: 'DM Mono, monospace', color: row.color }}>{fmtMoney(row.amount)}</span>
                </div>
                <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, borderRadius: 3, transition: 'width .6s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Status Donut */}
        <div className="card" style={{ padding: 22 }}>
          <CardHeader title="Payment Status" sub="Distribution across all players" />
          <DonutChart segments={donutSegs} />
        </div>

        {/* Attendance Trend */}
        <div className="card" style={{ padding: 22 }}>
          <CardHeader title="Attendance Trends" sub="Sessions scheduled vs attended" badge="Last 7 months" badgeColor="var(--cyan)" />
          <AttendanceBarChart data={monthly_attendance} />
          <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-dim)' }}>
              <div style={{ width: 10, height: 10, background: 'var(--surface3)', borderRadius: 2 }} /> Scheduled
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-dim)' }}>
              <div style={{ width: 10, height: 10, background: 'var(--cyan)', borderRadius: 2 }} /> Attended
            </div>
          </div>
        </div>
      </div>

      {/* Overdue Payments Table */}
      {overdue_list?.length > 0 && (
        <div className="card" style={{ padding: 22, marginBottom: 20 }}>
          <CardHeader title="Overdue Payments" sub="Players requiring payment follow-up" badge={`${overdue_list.length} players`} badgeColor="var(--pink)" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                <th style={{ textAlign: 'left', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Player</th>
                <th style={{ textAlign: 'left', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Team</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Amount</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Due Date</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Status</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {overdue_list.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(42,42,64,.5)' }}>
                  <td style={{ padding: '9px 0', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--grad1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                        {p.player_name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                      </div>
                      {p.player_name}
                    </div>
                  </td>
                  <td style={{ padding: '9px 0', fontSize: 12, color: 'var(--text-muted)' }}>{p.team_name || '—'}</td>
                  <td style={{ padding: '9px 0', textAlign: 'center', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: 'var(--pink)' }}>{fmtMoney(p.amount)}</td>
                  <td style={{ padding: '9px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{p.due_date ? new Date(p.due_date).toLocaleDateString() : '—'}</td>
                  <td style={{ padding: '9px 0', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'rgba(236,72,153,.15)', color: 'var(--pink)' }}>Overdue</span>
                  </td>
                  <td style={{ padding: '9px 0', textAlign: 'center' }}>
                    <button style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      Remind
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* All Teams Performance */}
      {teams_performance?.length > 0 && (
        <div className="card" style={{ padding: 22, marginBottom: 20 }}>
          <CardHeader title="All Teams Performance" sub="Season standings overview" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                <th style={{ textAlign: 'left', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Team</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Win Rate</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Set Ratio</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Attendance</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Points</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {teams_performance.map((t, i) => (
                <tr key={t.team_id} style={{ borderBottom: '1px solid rgba(42,42,64,.5)' }}>
                  <td style={{ padding: '10px 0', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: ['var(--purple)','var(--cyan)','var(--pink)','var(--green)','var(--yellow)'][i % 5] }} />
                      <div>
                        <div style={{ fontWeight: 600 }}>{t.team_name}</div>
                        {t.division && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t.division}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'center' }}><WinRateBar pct={t.win_rate} /></td>
                  <td style={{ padding: '10px 0', textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 700 }}>{t.set_ratio}</td>
                  <td style={{ padding: '10px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{t.team_attendance_rate}%</td>
                  <td style={{ padding: '10px 0', textAlign: 'center', fontFamily: 'DM Mono, monospace', fontWeight: 800, fontSize: 15 }}>{t.points}</td>
                  <td style={{ padding: '10px 0', textAlign: 'center' }}><TrendChip winRate={t.win_rate} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Registration by team */}
      {registration_by_team?.length > 0 && (
        <div className="card" style={{ padding: 22 }}>
          <CardHeader title="Registration by Team" sub="Active players per team" />
          {registration_by_team.map((r, i) => (
            <TeamRegBar key={i} name={r.team_name} count={r.player_count} max={maxReg} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── COACH ANALYTICS VIEW ─────────────────────────────────────────────────────
function CoachView() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTeam, setSelectedTeam] = useState(null)

  const load = useCallback((teamId) => {
    setLoading(true)
    const params = teamId ? `?team_id=${teamId}` : ''
    api.get(`/analytics/coach${params}`)
      .then(r => {
        setData(r.data)
        setSelectedTeam(r.data.team?.id)
      })
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(null) }, [load])

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading analytics…</div>
  if (error)   return <div style={{ textAlign: 'center', padding: 60, color: 'var(--pink)' }}>{error}</div>

  const { team, team_list, kpi, player_attendance, recent_matches, top_stats } = data

  const POS_LABELS = {
    setter: 'Setter', libero: 'Libero', outside_hitter: 'OH',
    opposite: 'OPP', middle_blocker: 'MB', defensive_specialist: 'DS',
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{
            fontSize: 28, fontWeight: 800,
            background: 'linear-gradient(135deg,#06b6d4 0%,#10b981 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            {team?.name} — Team Analytics
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Your team only · Coach view
          </div>
        </div>
        {/* Team switcher (for admin or multi-team coaches) */}
        {team_list?.length > 1 && (
          <select className="select" style={{ fontSize: 12 }} value={selectedTeam || ''} onChange={e => { setSelectedTeam(Number(e.target.value)); load(Number(e.target.value)) }}>
            {team_list.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      {/* Scope notice */}
      <div style={{
        background: 'rgba(6,182,212,.07)', border: '1px solid rgba(6,182,212,.2)',
        borderRadius: 12, padding: '12px 18px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-muted)',
      }}>
        🔍 Viewing <strong style={{ color: 'var(--cyan)', marginLeft: 4 }}>{team?.name}</strong> only. Contact your club admin for cross-club data.
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard icon="📅" value={`${kpi.attendance_rate}%`} label="Team Attendance" accentColor="var(--cyan)"
          delta={kpi.attendance_rate >= 80 ? '▲ On target' : '▼ Needs attention'} deltaUp={kpi.attendance_rate >= 80} />
        <KpiCard icon="🏆" value={`${kpi.wins}–${kpi.losses}`} label="Win / Loss Record" accentColor="var(--green)"
          delta={`${kpi.points} pts · ${kpi.played} played`} />
        <KpiCard icon="⚡" value={kpi.set_ratio} label="Set Ratio (W/L)" accentColor="var(--purple-light)"
          delta={kpi.set_ratio > 1 ? '▲ Positive ratio' : '▼ Below even'} deltaUp={kpi.set_ratio > 1} />
        <KpiCard icon="👤" value={fmt(kpi.player_count)} label="Registered Players" accentColor="var(--yellow)"
          delta="Active roster" />
      </div>

      {/* Row 2: Player Attendance + Match Results */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Player Attendance */}
        <div className="card" style={{ padding: 22 }}>
          <CardHeader title="Player Attendance" sub="Individual session attendance this season" badge={`${kpi.player_count} Players`} badgeColor="var(--cyan)" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                <th style={{ textAlign: 'left', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Player</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Position</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Sessions</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Rate</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Risk</th>
              </tr>
            </thead>
            <tbody>
              {player_attendance?.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)', fontSize: 12 }}>No attendance data yet</td></tr>
              )}
              {player_attendance?.map((p, i) => {
                const barColor = p.rate >= 80 ? 'var(--green)' : p.rate >= 60 ? 'var(--yellow)' : 'var(--pink)'
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(42,42,64,.5)' }}>
                    <td style={{ padding: '9px 0', fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--grad1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                          {p.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                        </div>
                        {p.name}
                      </div>
                    </td>
                    <td style={{ padding: '9px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{POS_LABELS[p.position] || p.position || '—'}</td>
                    <td style={{ padding: '9px 0', textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{p.attended}/{p.total_sessions}</td>
                    <td style={{ padding: '9px 0', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                        <div style={{ width: 50, height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${p.rate}%`, background: barColor, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace' }}>{p.rate}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 0', textAlign: 'center' }}><RiskChip risk={p.risk} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Match Results */}
        <div className="card" style={{ padding: 22 }}>
          <CardHeader title="Match Results" sub={`${kpi.played} played`} badge={`${kpi.wins}W – ${kpi.losses}L`} badgeColor="var(--green)" />
          {!recent_matches?.length ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, padding: 24 }}>No completed matches yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recent_matches.map((m, i) => (
                <div key={m.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>vs {m.opponent}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {m.match_date ? new Date(m.match_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 15, fontWeight: 700, color: m.result === 'W' ? 'var(--green)' : 'var(--pink)' }}>
                    {m.sets_us != null ? `${m.sets_us}–${m.sets_them}` : '—'}
                  </div>
                  {m.result && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: m.result === 'W' ? 'rgba(16,185,129,.15)' : 'rgba(236,72,153,.15)', color: m.result === 'W' ? 'var(--green)' : 'var(--pink)' }}>
                      {m.result === 'W' ? 'WIN' : 'LOSS'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Player Stats */}
      {top_stats?.length > 0 && (
        <div className="card" style={{ padding: 22 }}>
          <CardHeader title="Top Player Performances" sub="Key stats this season" badge="Season Stats" badgeColor="var(--cyan)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {top_stats.map((p, i) => (
              <div key={p.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--grad1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                      {p.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                    </div>
                    {p.name}
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: 'rgba(6,182,212,.15)', color: 'var(--cyan)' }}>
                      {POS_LABELS[p.position] || p.position || '—'}
                    </span>
                  </div>
                  {i === 0 && <span style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 700 }}>★ Top scorer</span>}
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  {[
                    { val: p.points, lbl: 'Points', color: 'var(--cyan)' },
                    { val: p.kills,  lbl: 'Kills',  color: 'var(--pink)' },
                    { val: p.aces,   lbl: 'Aces',   color: 'var(--purple-light)' },
                    { val: p.blocks, lbl: 'Blocks',  color: 'var(--green)' },
                    { val: p.digs,   lbl: 'Digs',   color: 'var(--yellow)' },
                    { val: p.errors, lbl: 'Errors',  color: 'var(--text-dim)' },
                  ].map((s, j) => (
                    <div key={j} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'DM Mono, monospace', color: s.color }}>{s.val ?? '—'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{s.lbl}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Analytics Page ──────────────────────────────────────────────────────
export default function Analytics() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <div>
      {user.role === 'admin' ? <AdminView /> : <CoachView />}
    </div>
  )
}
