import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login }    = useAuth()
  const navigate     = useNavigate()
  const [form, setForm]   = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏐</div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.8rem', background: 'var(--grad1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            VolleyOps
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Sign in to your account</p>
        </div>

        <div className="card">
          {error && (
            <div style={{ background: 'rgba(236,72,153,.1)', border: '1px solid rgba(236,72,153,.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, color: 'var(--pink)', fontSize: 13, fontWeight: 500 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label>Email</label>
              <input className="input" type="email" placeholder="you@example.com" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="form-row">
              <label>Password</label>
              <input className="input" type="password" placeholder="••••••••" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              <div style={{ textAlign: 'right', marginTop: 4 }}>
                <Link to="/forgot-password" style={{ fontSize: 12, color: 'var(--purple-light)', fontWeight: 600, textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, marginTop: 8 }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
            New player?{' '}
            <Link to="/register" style={{ color: 'var(--purple-light)', fontWeight: 600, textDecoration: 'none' }}>
              Register here
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
