import { Link } from 'react-router-dom'

const FEATURES = [
  { icon: '📋', title: 'Registration',        desc: 'Online player and team registration with custom forms and automated workflows.' },
  { icon: '💳', title: 'Payments',            desc: 'Flexible payment management with payment plans, installments, and automated reminders.' },
  { icon: '👥', title: 'Team Rosters',        desc: 'Comprehensive roster management with intelligent team assignments and publishing.' },
  { icon: '🏆', title: 'Standings',           desc: 'Live standings view with team rank, points, and key stats for quick league tracking.' },
  { icon: '💬', title: 'Communication',       desc: 'Built-in email and in-app notifications to keep coaches, players, and admins connected.' },
  { icon: '🎯', title: 'Tactics Board + AI',  desc: 'Digital court board for coaches with AI-powered rotation and counter-tactic suggestions.' },
]

const STEPS = [
  { icon: '📝', title: 'Registration',   desc: 'Players register and select preferred positions' },
  { icon: '✅', title: 'Approval',       desc: 'Admin reviews and approves registrations' },
  { icon: '👥', title: 'Team Formation', desc: 'Coaches build rosters and assign players' },
  { icon: '🤖', title: 'AI Tactics',     desc: 'Smart rotation and strategy suggestions' },
  { icon: '🏆', title: 'Game Day',       desc: 'Published rosters and live standings' },
]

export default function Landing() {
  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', color: '#0F1729', background: '#F8F9FC', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Header ── */}
      <header style={{ position: 'fixed', top: 0, width: '100%', padding: '1.2rem 5%', background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(10px)', zIndex: 1000, borderBottom: '1px solid rgba(65,88,208,.1)' }}>
        <nav style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🏐</span>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '1.35rem' }}>VolleyOps</span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Link to="/register" style={{ textDecoration: 'none', color: '#475569', fontWeight: 500, fontSize: 14 }}>Register</Link>
            <Link to="/login"    style={{ textDecoration: 'none', color: '#475569', fontWeight: 500, fontSize: 14 }}>Login</Link>
            <Link to="/login" style={{ background: 'linear-gradient(135deg,#4158D0,#C850C0)', color: '#fff', padding: '.65rem 1.6rem', borderRadius: 50, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section style={{ paddingTop: '8rem', paddingBottom: '4rem', maxWidth: 1400, margin: '0 auto', padding: '8rem 5% 4rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '3.2rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.5rem', background: 'linear-gradient(135deg,#4158D0,#C850C0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Volleyball-First Club Management
          </h1>
          <p style={{ fontSize: '1.15rem', color: '#5A6C7D', marginBottom: '2rem', lineHeight: 1.6 }}>
            The all-in-one platform built specifically for volleyball clubs. Streamline registrations, team formation, payments, tactics, and communication.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link to="/register" style={{ background: 'linear-gradient(135deg,#FF5A7E,#C850C0)', color: '#fff', padding: '1rem 2.5rem', borderRadius: 50, fontWeight: 600, textDecoration: 'none', display: 'inline-block', transition: 'transform .2s' }}>
              Start Free
            </Link>
            <Link to="/login" style={{ background: 'transparent', color: '#4158D0', padding: '1rem 2.5rem', border: '2px solid #4158D0', borderRadius: 50, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
              Sign In
            </Link>
          </div>
        </div>
        <div style={{ height: 420, background: 'linear-gradient(135deg,rgba(65,88,208,.1),rgba(200,80,192,.1))', borderRadius: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: '100%', height: 3, background: 'linear-gradient(90deg,transparent 10%,#4158D0 10%,#4158D0 90%,transparent 100%)', top: '50%' }} />
          <div style={{ width: 110, height: 110, background: 'linear-gradient(135deg,#fff,#f0f0f0)', borderRadius: '50%', boxShadow: '0 20px 60px rgba(0,0,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
            🏐
          </div>
        </div>
      </section>

      {/* ── Workflow ── */}
      <section style={{ background: 'linear-gradient(135deg,#4158D0,#C850C0)', padding: '5rem 5%', color: '#fff' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.2rem', fontWeight: 800, marginBottom: '.75rem' }}>
            🏐 End-to-End Club Workflow
          </h2>
          <p style={{ fontSize: '1.1rem', opacity: .9, marginBottom: '3rem' }}>From registration to game day — fully connected</p>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {STEPS.map((step, i) => (
              <div key={step.title} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'rgba(255,255,255,.12)', backdropFilter: 'blur(10px)', padding: '1.5rem 1.25rem', borderRadius: 20, border: '2px solid rgba(255,255,255,.2)', minWidth: 160, textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>{step.icon}</div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{step.title}</div>
                  <div style={{ fontSize: '0.8rem', opacity: .9 }}>{step.desc}</div>
                </div>
                {i < STEPS.length - 1 && <span style={{ fontSize: 24, opacity: .5 }}>→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '5rem 5%', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.2rem', fontWeight: 800, marginBottom: '.75rem' }}>Everything Your Club Needs</h2>
          <p style={{ fontSize: '1.1rem', color: '#5A6C7D' }}>Core features designed for day-to-day volleyball club operations</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {FEATURES.map((f, i) => {
            const colors = [
              'linear-gradient(135deg,#667eea,#764ba2)',
              'linear-gradient(135deg,#f093fb,#f5576c)',
              'linear-gradient(135deg,#4facfe,#00f2fe)',
              'linear-gradient(135deg,#43e97b,#38f9d7)',
              'linear-gradient(135deg,#fa709a,#fee140)',
              'linear-gradient(135deg,#a18cd1,#fbc2eb)',
            ]
            return (
              <div key={f.title} style={{ background: '#fff', padding: '2.5rem', borderRadius: 20, boxShadow: '0 5px 20px rgba(0,0,0,.05)', border: '2px solid transparent', transition: 'all .3s', cursor: 'default' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = '#4158D0'; e.currentTarget.style.boxShadow = '0 15px 40px rgba(65,88,208,.15)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0 5px 20px rgba(0,0,0,.05)' }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: colors[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: '1.25rem' }}>
                  {f.icon}
                </div>
                <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '1.3rem', marginBottom: '.6rem' }}>{f.title}</h3>
                <p style={{ color: '#5A6C7D', lineHeight: 1.6, fontSize: '0.95rem' }}>{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: '#0F1729', padding: '5rem 5%', textAlign: 'center', color: '#fff' }}>
        <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.2rem', fontWeight: 800, marginBottom: '1rem' }}>
          Ready to run your club smarter?
        </h2>
        <p style={{ color: 'rgba(255,255,255,.7)', marginBottom: '2rem', fontSize: '1.1rem' }}>Join VolleyOps and take control of every aspect of your club.</p>
        <Link to="/register" style={{ background: 'linear-gradient(135deg,#FF5A7E,#C850C0)', color: '#fff', padding: '1rem 3rem', borderRadius: 50, fontWeight: 700, fontSize: '1rem', textDecoration: 'none', display: 'inline-block' }}>
          Get Started Free
        </Link>
      </section>

      <footer style={{ background: '#0a0a0f', color: 'rgba(255,255,255,.5)', padding: '2rem 5%', textAlign: 'center', fontSize: 13 }}>
        © 2026 VolleyOps. One Platform. One Team.
      </footer>
    </div>
  )
}
