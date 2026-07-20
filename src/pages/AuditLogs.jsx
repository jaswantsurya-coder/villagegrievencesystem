import { History, Search, Shield, User } from 'lucide-react'

const mockLogs = [
  { id: 'LOG-9901', action: 'Approved Admin Verification Request', user: 'SuperAdmin (superadmin@gramseva.in)', target: 'Madhava Rao (Addategala)', ip: '157.48.21.94', time: '16 May 2025, 04:21 PM' },
  { id: 'LOG-9902', action: 'Approved Admin Verification Request', user: 'SuperAdmin (superadmin@gramseva.in)', target: 'Jyothi Prakash (Duggirala)', ip: '157.48.21.94', time: '16 May 2025, 03:42 PM' },
  { id: 'LOG-9903', action: 'Escalated Complaint #GS-2025-18569', user: 'System SLA Automation', target: 'Panchayat Lead (Krishna)', ip: 'Internal Engine', time: '15 May 2025, 11:30 AM' },
  { id: 'LOG-9904', action: 'Generated Join Code GS-88491', user: 'SuperAdmin (superadmin@gramseva.in)', target: 'Peddapudi Village', ip: '157.48.21.94', time: '14 May 2025, 09:15 AM' },
]

export default function AuditLogs() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>System Audit Logs</h1>
          <p style={styles.pageSubtitle}>Immutable security & administrative activity trail</p>
        </div>
      </div>

      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Log ID</th>
              <th style={styles.th}>Action</th>
              <th style={styles.th}>Executed By</th>
              <th style={styles.th}>Target Subject</th>
              <th style={styles.th}>IP Address</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {mockLogs.map((l) => (
              <tr key={l.id} style={styles.tr}>
                <td style={styles.tdMono}>{l.id}</td>
                <td style={styles.tdBold}>{l.action}</td>
                <td style={styles.td}>{l.user}</td>
                <td style={styles.tdMuted}>{l.target}</td>
                <td style={styles.tdMono}>{l.ip}</td>
                <td style={{ ...styles.tdMono, textAlign: 'right' }}>{l.time}</td>
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
  card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' },
  tr: { borderBottom: '1px solid #F1F5F9' },
  td: { padding: '12px 14px', color: '#0F172A' },
  tdBold: { padding: '12px 14px', fontWeight: 700, color: '#0F172A' },
  tdMuted: { padding: '12px 14px', color: '#64748B' },
  tdMono: { padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: '#64748B' },
}
