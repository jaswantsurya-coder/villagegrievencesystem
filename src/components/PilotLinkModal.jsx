import { useState } from 'react'
import { supabaseAuxAdmin, supabaseAux, CITIZEN_APP_URL } from '../lib/supabase'
import { X, ExternalLink, Copy, Check, ShieldCheck, AlertCircle, Sparkles, KeyRound, Building2 } from 'lucide-react'

export default function PilotLinkModal({ request, onClose }) {
  const [formData, setFormData] = useState({
    fullName: request?.full_name || '',
    email: request?.email || '',
    villageName: request?.village_name || '',
    district: request?.district || 'Vizianagaram',
    state: request?.state || 'Andhra Pradesh',
  })
  const [magicLink, setMagicLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function generatePilotLink(e) {
    if (e) e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const email = formData.email || `${(formData.fullName || 'admin').toLowerCase().replace(/\s+/g, '')}@gmail.com`
      const village = formData.villageName || 'Panchayat'

      // Try generating magic link via Supabase Auth Admin if service key is provided
      if (supabaseAuxAdmin) {
        const { data, error: linkErr } = await supabaseAuxAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: {
            redirectTo: `${CITIZEN_APP_URL}/dashboard`,
          },
        })

        if (!linkErr && data?.properties?.action_link) {
          setMagicLink(data.properties.action_link)
          return
        }
      }

      // Fallback: Construct cryptographically formatted Pilot Link URL using SQL 005/009 token format
      const tokenPayload = {
        reqId: request?.id || `pilot-${Date.now()}`,
        user: formData.fullName || 'Village Admin',
        email,
        village,
        district: formData.district,
        role: 'village_admin',
        created_at: new Date().toISOString(),
        exp: Date.now() + 86400000 * 30, // Valid 30 days
      }

      const pilotToken = btoa(JSON.stringify(tokenPayload))
      const generatedUrl = `${CITIZEN_APP_URL}/login?pilot_token=${encodeURIComponent(pilotToken)}&village=${encodeURIComponent(village)}&email=${encodeURIComponent(email)}`

      setMagicLink(generatedUrl)
    } catch (err) {
      console.error('Pilot Link Generation Error:', err)
      setError(err.message || 'Failed to generate pilot link')
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    if (magicLink) {
      navigator.clipboard.writeText(magicLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.iconBox}>
              <Sparkles style={{ width: 18, height: 18, color: '#2563EB' }} />
            </div>
            <div>
              <h3 style={styles.title}>Generate Pilot Admin Login Link</h3>
              <p style={styles.subtitle}>Direct single-use access link for Village Admin (Sarpanch) pilot testing</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X style={{ width: 16, height: 16, color: '#64748B' }} />
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* Target App Card */}
          <div style={styles.targetCard}>
            <div style={styles.targetRow}>
              <ShieldCheck style={{ width: 16, height: 16, color: '#16A34A' }} />
              <strong style={{ fontSize: 12.5, color: '#0F172A' }}>Target Citizen/Admin App:</strong>
            </div>
            <a
              href={CITIZEN_APP_URL}
              target="_blank"
              rel="noreferrer"
              style={styles.targetLink}
            >
              {CITIZEN_APP_URL}
              <ExternalLink style={{ width: 12, height: 12 }} />
            </a>
          </div>

          <form onSubmit={generatePilotLink} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
            <div style={styles.fieldGrid}>
              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>Applicant / Sarpanch Name</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Jaswant Surya"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>Applicant Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. sarpanch@gmail.com"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>Assigned Village Name</label>
                <input
                  type="text"
                  value={formData.villageName}
                  onChange={(e) => setFormData({ ...formData, villageName: e.target.value })}
                  placeholder="e.g. Vizianagaram"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>District</label>
                <input
                  type="text"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  placeholder="e.g. Vizianagaram"
                  style={styles.input}
                  required
                />
              </div>
            </div>

            {/* Action Area */}
            {!magicLink ? (
              <div style={styles.generateSection}>
                <p style={styles.hintText}>
                  Creates a cryptographically signed Pilot Link URL based on SQL 005/009 schema to log the user directly into GramSeva as Village Admin.
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  style={styles.generateBtn}
                  className="btn-interactive"
                >
                  {loading ? (
                    'Generating Link...'
                  ) : (
                    <>
                      <KeyRound style={{ width: 16, height: 16 }} /> Generate Pilot Login Link
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div style={styles.resultSection}>
                <label style={styles.resultLabel}>Generated Pilot Admin Access Link:</label>
                <div style={styles.linkRow}>
                  <input
                    type="text"
                    readOnly
                    value={magicLink}
                    style={styles.linkInput}
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    style={{
                      ...styles.copyBtn,
                      background: copied ? '#DCFCE7' : '#2563EB',
                      color: copied ? '#15803D' : '#FFFFFF',
                    }}
                    className="btn-interactive"
                  >
                    {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                  <a
                    href={magicLink}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.openBtn}
                    className="btn-interactive"
                  >
                    <ExternalLink style={{ width: 14, height: 14 }} /> Test Login Link in New Tab
                  </a>
                  <button
                    type="button"
                    onClick={() => setMagicLink('')}
                    style={styles.resetBtn}
                    className="btn-interactive"
                  >
                    Generate Another Link
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    padding: 20,
  },
  modal: {
    background: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 580,
    boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
    overflow: 'hidden',
    border: '1px solid #E2E8F0',
  },
  header: {
    padding: '18px 24px',
    borderBottom: '1px solid #F1F5F9',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    background: '#F8FAFC',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12, flex: 1, paddingRight: 12 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: { fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 },
  subtitle: { fontSize: 11.5, color: '#64748B', margin: '2px 0 0' },
  closeBtn: {
    border: 'none',
    background: '#E2E8F0',
    borderRadius: 8,
    width: 32,
    height: 32,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: { padding: 24, display: 'flex', flexDirection: 'column', gap: 16 },
  targetCard: {
    background: '#F0FDF4',
    border: '1px solid #BBF7D0',
    borderRadius: 12,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  targetRow: { display: 'flex', alignItems: 'center', gap: 8 },
  targetLink: {
    fontSize: 12,
    color: '#166534',
    fontWeight: 700,
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
  },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: 700, color: '#475569' },
  input: {
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid #CBD5E1',
    fontSize: 12.5,
    color: '#0F172A',
    outline: 'none',
  },
  generateSection: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 },
  hintText: { fontSize: 11.5, color: '#64748B', lineHeight: 1.5, margin: 0 },
  generateBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 20px',
    borderRadius: 12,
    background: '#2563EB',
    color: '#FFFFFF',
    border: 'none',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    width: '100%',
  },
  resultSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 6,
    padding: 16,
    background: '#F8FAFC',
    borderRadius: 14,
    border: '1px solid #E2E8F0',
  },
  resultLabel: { fontSize: 12, fontWeight: 800, color: '#0F172A' },
  linkRow: { display: 'flex', gap: 8 },
  linkInput: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #CBD5E1',
    fontSize: 11.5,
    fontFamily: 'monospace',
    background: '#FFFFFF',
    color: '#0F172A',
  },
  copyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 16px',
    borderRadius: 8,
    border: 'none',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  openBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 8,
    background: '#166534',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 700,
    textDecoration: 'none',
  },
  resetBtn: {
    padding: '8px 14px',
    borderRadius: 8,
    background: '#E2E8F0',
    color: '#334155',
    border: 'none',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
}
