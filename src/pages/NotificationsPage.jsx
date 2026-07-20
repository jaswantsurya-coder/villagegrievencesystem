import { Bell, AlertTriangle, Building2, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react'

const notifications = [
  { id: 1, title: 'Complaint Escalated', desc: 'Water contamination issue in Vizianagaram exceeded 48h SLA', time: '09:41 AM', type: 'alert', icon: AlertTriangle, color: '#B91C1C', bg: '#FEE2E2' },
  { id: 2, title: 'Village Joined', desc: 'New Panchayat Peddapudi (Prakasam) joined the network', time: '09:32 AM', type: 'info', icon: Building2, color: '#2563EB', bg: '#EFF6FF' },
  { id: 3, title: 'Officer Assigned', desc: 'Insp. V. Ramesh assigned to complaint #GS-2025-18573', time: '09:39 AM', type: 'success', icon: ShieldCheck, color: '#8B5CF6', bg: '#F3E8FF' },
  { id: 4, title: 'Admin Request Received', desc: 'New Sarpanch verification request from Lakshmi Narayana (Kurnool)', time: '09:28 AM', type: 'warning', icon: FileText, color: '#B45309', bg: '#FEF3C7' },
]

export default function NotificationsPage() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Notification Center</h1>
          <p style={styles.pageSubtitle}>Realtime system telemetry, SLA escalations & platform notifications</p>
        </div>
      </div>

      <div style={styles.list}>
        {notifications.map((n) => {
          const Icon = n.icon
          return (
            <div key={n.id} style={styles.card}>
              <div style={{ ...styles.iconBox, background: n.bg, color: n.color }}>
                <Icon style={{ width: 18, height: 18 }} />
              </div>
              <div style={styles.content}>
                <div style={styles.titleRow}>
                  <h4 style={styles.title}>{n.title}</h4>
                  <span style={styles.time}>{n.time}</span>
                </div>
                <p style={styles.desc}>{n.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: 20 },
  header: { marginBottom: 4 },
  pageTitle: { fontSize: 22, fontWeight: 800, color: '#0F172A' },
  pageSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4 },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' },
  iconBox: { width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  content: { flex: 1 },
  titleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 14, fontWeight: 700, color: '#0F172A' },
  time: { fontSize: 11, fontFamily: 'var(--font-mono)', color: '#94A3B8' },
  desc: { fontSize: 12.5, color: '#64748B', marginTop: 2 },
}
