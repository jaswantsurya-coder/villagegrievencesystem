import { LifeBuoy, Search, Bug, MessageSquare, ShieldAlert, CheckCircle2 } from 'lucide-react'

const mockTickets = [
  { id: 'HD-801', title: 'Sarpanch OTP login delay in Peddapudi', category: 'Bug Report', priority: 'High', status: 'Open', assigned: 'Tech Support', created: '17 May 2025' },
  { id: 'HD-802', title: 'Export PDF option request for monthly complaints', category: 'Feature Request', priority: 'Medium', status: 'In Progress', assigned: 'UI Dev', created: '16 May 2025' },
  { id: 'HD-803', title: 'Gram Panchayat document upload size limit inquiry', category: 'Admin Support', priority: 'Low', status: 'Resolved', assigned: 'Support Lead', created: '15 May 2025' },
  { id: 'HD-804', title: 'Join code verification timeout error on mobile', category: 'Bug Report', priority: 'High', status: 'Closed Today', assigned: 'Backend Dev', created: '15 May 2025' },
]

export default function HelpDesk() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Help Desk & Support Center</h1>
          <p style={styles.pageSubtitle}>Bug reports, feature requests & Sarpanch admin support</p>
        </div>
      </div>

      <div style={styles.statsRow}>
        <div style={{ ...styles.statTile, background: '#EFF6FF', color: '#1D4ED8' }}>
          <span style={styles.tileLabel}>Open Tickets</span>
          <span style={styles.tileCount}>24</span>
        </div>
        <div style={{ ...styles.statTile, background: '#FEF3C7', color: '#B45309' }}>
          <span style={styles.tileLabel}>In Progress</span>
          <span style={styles.tileCount}>11</span>
        </div>
        <div style={{ ...styles.statTile, background: '#DCFCE7', color: '#15803D' }}>
          <span style={styles.tileLabel}>Resolved</span>
          <span style={styles.tileCount}>156</span>
        </div>
        <div style={{ ...styles.statTile, background: '#F3E8FF', color: '#6B21A8' }}>
          <span style={styles.tileLabel}>Closed Today</span>
          <span style={styles.tileCount}>14</span>
        </div>
      </div>

      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Ticket ID</th>
              <th style={styles.th}>Subject</th>
              <th style={styles.th}>Category</th>
              <th style={styles.th}>Priority</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Assigned Staff</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Created Date</th>
            </tr>
          </thead>
          <tbody>
            {mockTickets.map((t) => (
              <tr key={t.id} style={styles.tr}>
                <td style={styles.tdMono}>{t.id}</td>
                <td style={styles.tdBold}>{t.title}</td>
                <td style={styles.td}>{t.category}</td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.badge,
                      background: t.priority === 'High' ? '#FEE2E2' : '#FEF3C7',
                      color: t.priority === 'High' ? '#B91C1C' : '#B45309',
                    }}
                  >
                    {t.priority}
                  </span>
                </td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.badge,
                      background: t.status === 'Resolved' ? '#DCFCE7' : t.status === 'Open' ? '#EFF6FF' : '#FEF3C7',
                      color: t.status === 'Resolved' ? '#15803D' : t.status === 'Open' ? '#1D4ED8' : '#B45309',
                    }}
                  >
                    {t.status}
                  </span>
                </td>
                <td style={styles.tdBold}>{t.assigned}</td>
                <td style={{ ...styles.tdMono, textAlign: 'right' }}>{t.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: 20 },
  header: { marginBottom: 4 },
  pageTitle: { fontSize: 22, fontWeight: 800, color: '#0F172A' },
  pageSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 },
  statTile: { padding: '16px', borderRadius: 14, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  tileLabel: { fontSize: 11, fontWeight: 700, marginBottom: 4 },
  tileCount: { fontSize: 24, fontWeight: 800 },
  card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' },
  tr: { borderBottom: '1px solid #F1F5F9' },
  td: { padding: '12px 14px', color: '#0F172A' },
  tdBold: { padding: '12px 14px', fontWeight: 700, color: '#0F172A' },
  tdMono: { padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: '#64748B' },
  badge: { fontSize: 10.5, fontWeight: 700, borderRadius: 99, padding: '3px 8px' },
}
