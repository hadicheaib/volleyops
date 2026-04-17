import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const STATUS_BADGE = { pending: 'badge-yellow', paid: 'badge-green', overdue: 'badge-pink', cancelled: 'badge-dim' }

function CreatePlanModal({ onClose, onCreated }) {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', description: '', total_amount: '', installment_count: 1, interval_days: 30 })
  const [loading, setLoading] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/payments/plans', { ...form, total_amount: Number(form.total_amount), installment_count: Number(form.installment_count), interval_days: Number(form.interval_days) })
      toast('Plan created', 'success')
      onCreated(data)
    } catch (err) { toast(err.response?.data?.error || 'Failed', 'error') }
    finally { setLoading(false) }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Create Payment Plan</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-row"><label>Plan Name *</label><input className="input" required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Full Season Fee" /></div>
          <div className="form-row"><label>Description</label><textarea className="textarea" rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Optional description…" /></div>
          <div className="form-grid">
            <div className="form-row"><label>Total Amount ($) *</label><input className="input" type="number" required min="1" step="0.01" value={form.total_amount} onChange={e => setForm(f => ({...f, total_amount: e.target.value}))} placeholder="500" /></div>
            <div className="form-row"><label>Installments</label><input className="input" type="number" min="1" max="24" value={form.installment_count} onChange={e => setForm(f => ({...f, installment_count: e.target.value}))} /></div>
          </div>
          <div className="form-row"><label>Days Between Installments</label><input className="input" type="number" min="1" value={form.interval_days} onChange={e => setForm(f => ({...f, interval_days: e.target.value}))} /></div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create Plan'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AssignPlanModal({ onClose, onAssigned }) {
  const toast = useToast()
  const [players, setPlayers] = useState([])
  const [plans,   setPlans]   = useState([])
  const [playerId, setPlayerId] = useState('')
  const [planId,   setPlanId]   = useState('')
  const [firstDue, setFirstDue] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/players?status=approved&limit=100'),
      api.get('/payments/plans?active=true'),
    ]).then(([p, pl]) => { setPlayers(p.data.players || []); setPlans(pl.data.plans || []) }).catch(() => {})
  }, [])

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/payments/assign-plan', { playerId: Number(playerId), planId: Number(planId), firstDueDate: firstDue || undefined })
      toast(`Plan assigned – ${data.payments.length} installment(s) created`, 'success')
      onAssigned()
    } catch (err) { toast(err.response?.data?.error || 'Failed', 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><span className="modal-title">Assign Payment Plan</span><button className="modal-close" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="form-row"><label>Player *</label>
            <select className="select" required value={playerId} onChange={e => setPlayerId(e.target.value)}>
              <option value="">Select player…</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
          <div className="form-row"><label>Payment Plan *</label>
            <select className="select" required value={planId} onChange={e => setPlanId(e.target.value)}>
              <option value="">Select plan…</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name} – ${p.total_amount} ({p.installment_count} instalment{p.installment_count > 1 ? 's' : ''})</option>)}
            </select></div>
          <div className="form-row"><label>First Due Date</label><input className="input" type="date" value={firstDue} onChange={e => setFirstDue(e.target.value)} /></div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Assigning…' : 'Assign Plan'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Payments() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [payments, setPayments] = useState([])
  const [summary,  setSummary]  = useState(null)
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [filters,  setFilters]  = useState({ status: '', overdue_only: false, page: 1 })
  const [showPlan,   setShowPlan]   = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [working,  setWorking]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 50, page: filters.page }
      if (filters.status)      params.status = filters.status
      if (filters.overdue_only) params.overdue_only = 'true'
      const [pay, sum] = await Promise.all([
        api.get('/payments', { params }),
        api.get('/payments/summary'),
      ])
      setPayments(pay.data.payments || [])
      setTotal(pay.data.total || 0)
      setSummary(sum.data)
    } catch { toast('Failed to load payments', 'error') }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { load() }, [load])

  async function markPaid(id) {
    setWorking(true)
    try {
      await api.patch(`/payments/${id}/status`, { status: 'paid' })
      toast('Payment marked as paid', 'success')
      load()
    } catch { toast('Failed', 'error') }
    finally { setWorking(false) }
  }

  async function sendReminder(id) {
    try {
      await api.post(`/payments/${id}/remind`)
      toast('Reminder sent', 'success')
    } catch { toast('Failed to send reminder', 'error') }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Payments</div>
          <div className="page-subtitle">{total} records · manage fees, plans, and reminders</div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowPlan(true)}>+ New Plan</button>
            <button className="btn btn-primary" onClick={() => setShowAssign(true)}>Assign Plan</button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="kpi-grid mb-6">
          <div className="kpi-card"><div className="kpi-icon green">💰</div><div className="kpi-value">${summary.paid_amount?.toLocaleString()}</div><div className="kpi-label">Collected</div></div>
          <div className="kpi-card"><div className="kpi-icon yellow">⏳</div><div className="kpi-value">${summary.pending_amount?.toLocaleString()}</div><div className="kpi-label">Pending</div></div>
          <div className="kpi-card"><div className="kpi-icon pink">⚠️</div><div className="kpi-value">${summary.overdue_amount?.toLocaleString()}</div><div className="kpi-label">Overdue</div></div>
          <div className="kpi-card"><div className="kpi-icon purple">📊</div><div className="kpi-value">{summary.completion_rate}%</div><div className="kpi-label">Collection Rate</div>
            <div style={{ marginTop: 8, height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${summary.completion_rate}%`, background: 'var(--grad2)', borderRadius: 3 }} />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-row">
        {['', 'pending', 'paid', 'overdue', 'cancelled'].map(s => (
          <button key={s || 'all'} className={`filter-btn ${filters.status === s && !filters.overdue_only ? 'active' : ''}`}
            onClick={() => setFilters(f => ({ ...f, status: s, overdue_only: false, page: 1 }))}>
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
        <button className={`filter-btn ${filters.overdue_only ? 'active' : ''}`}
          onClick={() => setFilters(f => ({ ...f, overdue_only: !f.overdue_only, status: '', page: 1 }))}>
          ⚠️ Overdue Only
        </button>
      </div>

      <div className="card">
        {loading ? <div className="loading-center"><div className="spinner" /></div> :
         payments.length === 0 ? <div className="empty-state"><div className="empty-icon">💳</div><p>No payments found</p></div> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Player</th><th>Description</th><th>Amount</th><th>Due Date</th><th>Status</th>{isAdmin && <th>Actions</th>}</tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="cell-name">
                        <div className="avatar">{(p.player_name || '?').charAt(0)}</div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{p.player_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.team_name || 'No team'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{p.description || '—'}</div>
                      {p.plan_name && <div style={{ fontSize: 11, color: 'var(--purple-light)' }}>Plan: {p.plan_name}</div>}
                      {p.installment_number && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Instalment {p.installment_number}</div>}
                    </td>
                    <td style={{ fontWeight: 700, color: p.status === 'paid' ? 'var(--green)' : p.overdue ? 'var(--pink)' : 'var(--text)' }}>
                      ${Number(p.amount).toLocaleString()}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {p.due_date ? new Date(p.due_date).toLocaleDateString() : '—'}
                      {p.overdue && <div style={{ fontSize: 11, color: 'var(--pink)', fontWeight: 600 }}>OVERDUE</div>}
                    </td>
                    <td><span className={`badge ${STATUS_BADGE[p.status] || 'badge-dim'}`}>{p.status}</span></td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {p.status !== 'paid' && p.status !== 'cancelled' && (
                            <button className="btn btn-green btn-sm" disabled={working} onClick={() => markPaid(p.id)}>Mark Paid</button>
                          )}
                          {p.status !== 'paid' && (
                            <button className="btn btn-secondary btn-sm" onClick={() => sendReminder(p.id)}>📧 Remind</button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPlan   && <CreatePlanModal onClose={() => setShowPlan(false)} onCreated={() => { setShowPlan(false); load() }} />}
      {showAssign && <AssignPlanModal onClose={() => setShowAssign(false)} onAssigned={() => { setShowAssign(false); load() }} />}
    </div>
  )
}
