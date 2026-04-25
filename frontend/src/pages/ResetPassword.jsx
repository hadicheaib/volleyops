import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import api from '../api/client'

export default function ResetPassword() {
  const [searchParams]         = useSearchParams()
  const navigate               = useNavigate()
  const [form, setForm]        = useState({ newPassword: '', confirm: '' })
  const [loading, setLoading]  = useState(false)
  const [done, setDone]        = useState(false)
  const [error, setError]      = useState('')
  const token                  = searchParams.get('token') || ''

  useEffect(() => {
    if (!token) setError('No reset token found. Please request a new reset link.')
  }, [token])

  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => navigate('/login'), 3000)
    return () => clearTimeout(id)
  }, [done, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.newPassword !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, newPassword: form.newPassword })
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔐</div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.8rem', background: 'var(--grad1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Reset Password
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            Enter your new password below
          </p>
        </div>

        <div className="card">
          {done ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 8 }}>
                Password reset successfully!
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Redirecting you to the login page…
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div style={{ background: 'rgba(236,72,153,.1)', border: '1px solid rgba(236,72,153,.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, color: 'var(--pink)', fontSize: 13, fontWeight: 500 }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <label>New Password</label>
                  <input className="input" type="password" placeholder="••••••••"
                    value={form.newPassword}
                    onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                    required minLength={8} disabled={!token} />
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label>Confirm New Password</label>
                  <input className="input" type="password" placeholder="••••••••"
                    value={form.confirm}
                    onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                    required minLength={8} disabled={!token} />
                </div>
                <button className="btn btn-primary" type="submit" disabled={loading || !token}
                  style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, marginTop: 16 }}>
                  {loading ? 'Resetting…' : 'Reset Password'}
                </button>
              </form>
            </>
          )}

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
            <Link to="/forgot-password" style={{ color: 'var(--purple-light)', fontWeight: 600, textDecoration: 'none' }}>
              Request a new link
            </Link>
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-dim)' }}>
          <Link to="/" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>← Back to home</Link>
        </p>
      </div>
    </div>
  )
}
