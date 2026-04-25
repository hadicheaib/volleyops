import { useState, useEffect } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const POSITION_OPTS = [
  { value: '', label: '— Select Position —' },
  { value: 'setter',               label: 'Setter' },
  { value: 'libero',               label: 'Libero' },
  { value: 'outside_hitter',       label: 'Outside Hitter' },
  { value: 'opposite',             label: 'Opposite' },
  { value: 'middle_blocker',       label: 'Middle Blocker' },
  { value: 'defensive_specialist', label: 'Defensive Specialist' },
]

export default function Profile() {
  const { user, isPlayer } = useAuth()
  const toast = useToast()

  // ── Account info ─────────────────────────────────────────────────────────────
  const [account, setAccount] = useState({ name: '', email: '' })
  const [acctLoading, setAcctLoading] = useState(false)

  // ── Password change ───────────────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)

  // ── Player bio (only for players) ─────────────────────────────────────────────
  const [player, setPlayer]   = useState(null)
  const [bio, setBio]         = useState({ phone: '', date_of_birth: '', position: '', jersey_number: '' })
  const [bioLoading, setBioLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    setAccount({ name: user.name || '', email: user.email || '' })

    if (isPlayer && user.player_id) {
      api.get(`/players/${user.player_id}`)
        .then(({ data }) => {
          setPlayer(data)
          setBio({
            phone:          data.phone          || '',
            date_of_birth:  data.date_of_birth  || '',
            position:       data.position        || '',
            jersey_number:  data.jersey_number != null ? String(data.jersey_number) : '',
          })
        })
        .catch(() => {})
    }
  }, [user, isPlayer])

  async function saveAccount(e) {
    e.preventDefault()
    setAcctLoading(true)
    try {
      await api.put(`/users/${user.id}`, { name: account.name, email: account.email })
      toast('Profile updated', 'success')
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to update profile', 'error')
    } finally {
      setAcctLoading(false)
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirm) {
      toast('Passwords do not match', 'error')
      return
    }
    setPwLoading(true)
    try {
      await api.post('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      })
      toast('Password changed — please sign in again', 'success')
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' })
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to change password', 'error')
    } finally {
      setPwLoading(false)
    }
  }

  async function saveBio(e) {
    e.preventDefault()
    if (!player) return
    setBioLoading(true)
    try {
      const payload = {
        phone:         bio.phone || null,
        date_of_birth: bio.date_of_birth || null,
        position:      bio.position || null,
        jersey_number: bio.jersey_number !== '' ? Number(bio.jersey_number) : null,
      }
      await api.put(`/players/${player.id}`, payload)
      toast('Player profile updated', 'success')
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to update player profile', 'error')
    } finally {
      setBioLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-header">
        <div>
          <div className="page-title">My Profile</div>
          <div className="page-subtitle">Manage your account details and security settings</div>
        </div>
      </div>

      {/* ── Account Info ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Account Information</div>
            <div className="card-sub">Update your name and email</div>
          </div>
        </div>
        <form onSubmit={saveAccount}>
          <div className="form-row">
            <label>Full Name</label>
            <input className="input" value={account.name}
              onChange={e => setAccount(a => ({ ...a, name: e.target.value }))}
              required placeholder="Your full name" />
          </div>
          <div className="form-row">
            <label>Email</label>
            <input className="input" type="email" value={account.email}
              onChange={e => setAccount(a => ({ ...a, email: e.target.value }))}
              required placeholder="you@example.com" />
          </div>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Role</label>
            <input className="input" value={user?.role?.replace('_', ' ')} readOnly
              style={{ opacity: 0.6, cursor: 'not-allowed', textTransform: 'capitalize' }} />
          </div>
          <div className="form-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" type="submit" disabled={acctLoading}>
              {acctLoading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Player Bio (players only) ── */}
      {isPlayer && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Player Profile</div>
              <div className="card-sub">Update your volleyball details</div>
            </div>
          </div>
          {!player && !user?.player_id ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>
              No player profile is linked to your account. Contact an admin for assistance.
            </p>
          ) : !player ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : (
            <form onSubmit={saveBio}>
              <div className="form-grid">
                <div className="form-row">
                  <label>Phone</label>
                  <input className="input" type="tel" value={bio.phone}
                    onChange={e => setBio(b => ({ ...b, phone: e.target.value }))}
                    placeholder="+1 555-000-0000" />
                </div>
                <div className="form-row">
                  <label>Date of Birth</label>
                  <input className="input" type="date" value={bio.date_of_birth}
                    onChange={e => setBio(b => ({ ...b, date_of_birth: e.target.value }))} />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-row">
                  <label>Position</label>
                  <select className="input" value={bio.position}
                    onChange={e => setBio(b => ({ ...b, position: e.target.value }))}>
                    {POSITION_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <label>Jersey Number</label>
                  <input className="input" type="number" min="0" max="99" value={bio.jersey_number}
                    onChange={e => setBio(b => ({ ...b, jersey_number: e.target.value }))}
                    placeholder="e.g. 7" />
                </div>
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Team</label>
                <input className="input" value={player.team_name || 'Unassigned'} readOnly
                  style={{ opacity: 0.6, cursor: 'not-allowed' }} />
              </div>
              <div className="form-actions" style={{ marginTop: 16 }}>
                <button className="btn btn-primary" type="submit" disabled={bioLoading}>
                  {bioLoading ? 'Saving…' : 'Save Player Profile'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Change Password ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Change Password</div>
            <div className="card-sub">Minimum 8 characters</div>
          </div>
        </div>
        <form onSubmit={changePassword}>
          <div className="form-row">
            <label>Current Password</label>
            <input className="input" type="password" value={pwForm.currentPassword}
              onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
              required placeholder="••••••••" />
          </div>
          <div className="form-row">
            <label>New Password</label>
            <input className="input" type="password" value={pwForm.newPassword}
              onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
              required minLength={8} placeholder="••••••••" />
          </div>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Confirm New Password</label>
            <input className="input" type="password" value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
              required minLength={8} placeholder="••••••••" />
          </div>
          <div className="form-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" type="submit" disabled={pwLoading}>
              {pwLoading ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
