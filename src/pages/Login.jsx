import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { signInWithPassword } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signInWithPassword(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Could not sign in. Check your email and password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.seal}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="19" stroke="#C9601E" strokeWidth="1.5" />
          <circle cx="20" cy="20" r="13" stroke="#C9601E" strokeWidth="1" />
          <text x="20" y="25" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fill="#C9601E">GS</text>
        </svg>
      </div>

      <div style={styles.card}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>admin.gramseva.in</p>
        <h1 style={styles.title}>Super Admin Register</h1>
        <p style={styles.subtitle}>Sign in to manage villages, approvals, and platform records.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={styles.input}
            />
          </label>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      <p style={styles.footer}>GramSeva</p>
      <p style={styles.poweredBy}>Powered by Solvx</p>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: 24,
  },
  seal: { marginBottom: 28 },
  card: {
    width: '100%',
    maxWidth: 380,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '32px 28px',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 26,
    fontWeight: 600,
    margin: '0 0 8px',
    color: 'var(--parchment)',
  },
  subtitle: {
    fontSize: 13.5,
    color: 'var(--stone)',
    margin: '0 0 24px',
    lineHeight: 1.5,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 12.5,
    color: 'var(--stone)',
    fontWeight: 500,
  },
  input: {
    background: 'var(--bg)',
    border: '1px solid var(--border-strong)',
    borderRadius: 3,
    padding: '10px 12px',
    color: 'var(--parchment)',
    fontSize: 14,
    fontFamily: 'var(--font-body)',
  },
  button: {
    marginTop: 8,
    background: 'var(--green)',
    color: 'var(--parchment)',
    border: '1px solid var(--green-bright)',
    borderRadius: 3,
    padding: '11px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    fontSize: 12.5,
    color: 'var(--terracotta)',
    margin: 0,
  },
  footer: {
    marginTop: 32,
    fontSize: 11.5,
    color: 'var(--stone-dim)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em',
  },
  poweredBy: {
    marginTop: 4,
    fontSize: 10.5,
    color: 'var(--stone-dim)',
    opacity: 0.6,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em',
  },
}
