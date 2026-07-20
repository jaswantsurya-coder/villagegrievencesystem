import { Shield, CheckCircle2, Server, Key, Mail, Database, Radio, Send, Cpu } from 'lucide-react'

export default function SettingsPage() {
  const healthItems = [
    { label: 'API Endpoint', status: 'Healthy', icon: Server, color: '#2563EB' },
    { label: 'Database (Supabase)', status: 'Healthy', icon: Database, color: '#2563EB' },
    { label: 'Storage Bucket', status: 'Healthy', icon: Server, color: '#2563EB' },
    { label: 'Authentication Service', status: 'Healthy', icon: Key, color: '#2563EB' },
    { label: 'AI Model (Qwen2.5)', status: 'Healthy', icon: Cpu, color: '#2563EB' },
    { label: 'Notification Service', status: 'Healthy', icon: Send, color: '#2563EB' },
    { label: 'Brevo SMTP Gateway', status: 'Connected', icon: Mail, color: '#166534' },
    { label: 'Realtime WebSockets', status: 'Connected', icon: Radio, color: '#166534' },
  ]

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Platform Settings & Health</h1>
          <p style={styles.pageSubtitle}>System health monitor, database parameters & Brevo email configuration</p>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Shield style={{ width: 20, height: 20, color: '#2563EB' }} />
          <h3 style={styles.cardTitle}>Platform Health Monitor</h3>
          <span style={styles.greenBadge}>● All Systems Operational</span>
        </div>

        <div style={styles.healthGrid}>
          {healthItems.map((h, idx) => {
            const Icon = h.icon
            return (
              <div key={idx} style={styles.healthCard}>
                <div style={{ ...styles.iconBox, color: h.color }}>
                  <Icon style={{ width: 16, height: 16 }} />
                </div>
                <div style={styles.healthInfo}>
                  <div style={styles.healthLabel}>{h.label}</div>
                  <div style={styles.healthStatus}>
                    <span style={styles.dot} /> {h.status}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Mail style={{ width: 20, height: 20, color: '#2563EB' }} />
          <h3 style={styles.cardTitle}>Email SMTP Configuration (Brevo)</h3>
        </div>

        <div style={styles.configGrid}>
          <div style={styles.configItem}>
            <span style={styles.configLabel}>SMTP Gateway</span>
            <strong style={styles.configVal}>smtp-relay.brevo.com</strong>
          </div>
          <div style={styles.configItem}>
            <span style={styles.configLabel}>Sender Email</span>
            <strong style={styles.configVal}>admin@gramseva.in</strong>
          </div>
          <div style={styles.configItem}>
            <span style={styles.configLabel}>Sender Name</span>
            <strong style={styles.configVal}>GramSeva Admin Portal</strong>
          </div>
          <div style={styles.configItem}>
            <span style={styles.configLabel}>Status</span>
            <strong style={{ ...styles.configVal, color: '#15803D' }}>Active & Sending</strong>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: 20 },
  header: { marginBottom: 4 },
  pageTitle: { fontSize: 22, fontWeight: 800, color: '#0F172A' },
  pageSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4 },
  card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 18, padding: '24px', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  cardTitle: { fontSize: 16, fontWeight: 800, color: '#0F172A' },
  greenBadge: { marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: '#15803D', background: '#DCFCE7', padding: '4px 12px', borderRadius: 99 },
  healthGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  healthCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: 12 },
  iconBox: { width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  healthInfo: { flex: 1 },
  healthLabel: { fontSize: 12, fontWeight: 700, color: '#0F172A' },
  healthStatus: { fontSize: 11, fontWeight: 700, color: '#15803D', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 99, background: '#22C55E' },
  configGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 },
  configItem: { display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #F1F5F9' },
  configLabel: { fontSize: 11, color: '#64748B', fontWeight: 600 },
  configVal: { fontSize: 13, color: '#0F172A', fontWeight: 700 },
}
