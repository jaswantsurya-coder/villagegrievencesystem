import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Shield, Loader2, AlertTriangle, Building2, Users, BarChart3, Lock } from 'lucide-react'

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
    if (!email || !password) {
      setError('Please enter both email and password.')
      return
    }
    setSubmitting(true)
    try {
      await signInWithPassword(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your credentials.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.page}>
      {/* LEFT PANEL — Brand */}
      <div style={styles.brandPanel}>
        <div style={styles.brandOverlay}>
          <div style={styles.brandContent}>
            <div style={styles.brandLogo}>
              <div style={styles.logoCircle}>
                <Shield style={{ width: 28, height: 28, color: '#FFFFFF' }} />
              </div>
              <span style={styles.logoText}>GramSeva</span>
            </div>

            <h1 style={styles.brandTitle}>Super Admin<br />Command Center</h1>
            <p style={styles.brandSubtitle}>
              Monitor villages, citizens, complaints, and platform health across all connected Panchayats in real time.
            </p>

            <div style={styles.statsGrid}>
              <div style={styles.statBox}>
                <Building2 style={{ width: 18, height: 18, color: '#93C5FD' }} />
                <div>
                  <div style={styles.statNum}>7</div>
                  <div style={styles.statLabel}>Villages</div>
                </div>
              </div>
              <div style={styles.statBox}>
                <Users style={{ width: 18, height: 18, color: '#93C5FD' }} />
                <div>
                  <div style={styles.statNum}>40</div>
                  <div style={styles.statLabel}>Citizens</div>
                </div>
              </div>
              <div style={styles.statBox}>
                <BarChart3 style={{ width: 18, height: 18, color: '#93C5FD' }} />
                <div>
                  <div style={styles.statNum}>7</div>
                  <div style={styles.statLabel}>Complaints</div>
                </div>
              </div>
            </div>

            <div style={styles.brandFooterBadge}>
              <span style={styles.liveDot} />
              Connected to 2 Supabase Clusters
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — Login Form */}
      <div style={styles.formPanel}>
        <div style={styles.formContainer}>
          <div style={styles.formHeader}>
            <div style={styles.formLogoSmall}>
              <Lock style={{ width: 16, height: 16, color: '#2563EB' }} />
            </div>
            <p style={styles.eyebrow}>ADMIN.GRAMSEVA.IN</p>
            <h2 style={styles.formTitle}>Welcome back</h2>
            <p style={styles.formSubtitle}>Sign in to access the Super Admin Dashboard</p>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@gramseva.in"
                required
                autoComplete="email"
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <div style={styles.labelRow}>
                <label style={styles.label}>Password</label>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={styles.input}
              />
            </div>

            {error && (
              <div style={styles.errorBox}>
                <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={submitting} style={styles.submitBtn} className="btn-interactive">
              {submitting ? (
                <>
                  <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                  Authenticating...
                </>
              ) : (
                'Sign in to Dashboard'
              )}
            </button>
          </form>

          <div style={styles.formFooter}>
            <p style={styles.footerText}>GramSeva Platform · Powered by <strong>Solvx</strong></p>
            <p style={styles.footerMuted}>Protected by Supabase Auth & Row-Level Security</p>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    background: '#F8FAFC',
  },

  /* ── LEFT BRAND PANEL ── */
  brandPanel: {
    flex: '0 0 45%',
    background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 40%, #1D4ED8 100%)',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandOverlay: {
    position: 'relative',
    zIndex: 1,
    padding: '48px 44px',
    width: '100%',
    maxWidth: 480,
  },
  brandContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
  },
  brandLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.15)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(255,255,255,0.2)',
  },
  logoText: {
    fontSize: 22,
    fontWeight: 800,
    color: '#FFFFFF',
    letterSpacing: '-0.02em',
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.15,
    letterSpacing: '-0.03em',
  },
  brandSubtitle: {
    fontSize: 14.5,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.6,
    maxWidth: 380,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    marginTop: 8,
  },
  statBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: '12px 14px',
  },
  statNum: {
    fontSize: 18,
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  brandFooterBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.03em',
    marginTop: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    background: '#22C55E',
    boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)',
    animation: 'pulse 2s ease-in-out infinite',
  },

  /* ── RIGHT FORM PANEL ── */
  formPanel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 32px',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
  },
  formHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  formLogoSmall: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#EFF6FF',
    border: '1px solid #DBEAFE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 10.5,
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    color: '#94A3B8',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  formTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: '#0F172A',
    letterSpacing: '-0.02em',
    marginTop: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 1.5,
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#334155',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid #CBD5E1',
    fontSize: 14,
    color: '#0F172A',
    background: '#FFFFFF',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 10,
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#B91C1C',
    fontSize: 12.5,
    fontWeight: 600,
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '13px 20px',
    borderRadius: 12,
    fontSize: 14.5,
    fontWeight: 700,
    color: '#FFFFFF',
    background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    marginTop: 4,
  },

  formFooter: {
    textAlign: 'center',
    paddingTop: 16,
    borderTop: '1px solid #E2E8F0',
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
  },
  footerMuted: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 4,
  },
}
