import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'

export default function ForgotPassword() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [devToken, setDevToken] = useState(null)
  const [error, setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/forgot-password', { email })
      setSent(true)
      // dev_token is only returned outside of production
      if (data.dev_token) setDevToken(data.dev_token)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔑</div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.8rem', background: 'var(--grad1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Forgot Password
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            Enter your email and we'll send a reset link
          </p>
        </div>

        <div className="card">
          {!sent ? (
            <>
              {error && (
                <div style={{ background: 'rgba(236,72,153,.1)', border: '1px solid rgba(236,72,153,.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, color: 'var(--pink)', fontSize: 13, fontWeight: 500 }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <label>Email Address</label>
                  <input className="input" type="email" placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <button className="btn btn-primary" type="submit" disabled={loading}
                  style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, marginTop: 8 }}>
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
              <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 8 }}>
                Reset link sent!
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
                If an account with that email exists, a password reset link has been sent. Check your inbox and spam folder.
              </p>

              {/* Dev helper: show token when SMTP is not configured */}
              {devToken && (
                <div style={{ marginTop: 20, background: 'rgba(124,58,237,.1)', border: '1px solid rgba(124,58,237,.3)', borderRadius: 10, padding: '12px 14px', textAlign: 'left' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--purple-light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Dev Mode — Reset Token
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all', fontFamily: 'monospace', marginBottom: 8 }}>
                    {devToken}
                  </div>
                  <Link
                    to={`/reset-password?token=${devToken}`}
                    style={{ fontSize: 12, color: 'var(--purple-light)', fontWeight: 600, textDecoration: 'none' }}
                  >
                    → Click here to reset →
                  </Link>
                </div>
              )}
            </div>
          )}

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
            Remembered it?{' '}
            <Link to="/login" style={{ color: 'var(--purple-light)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
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
