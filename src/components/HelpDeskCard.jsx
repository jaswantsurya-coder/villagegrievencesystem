import { LifeBuoy } from 'lucide-react'

export default function HelpDeskCard({ onViewAll }) {
  const tickets = [
    { label: 'Open', count: 24, bg: '#EFF6FF', color: '#1D4ED8' },
    { label: 'In Progress', count: 11, bg: '#FEF3C7', color: '#B45309' },
    { label: 'Resolved', count: 156, bg: '#DCFCE7', color: '#15803D' },
    { label: 'Closed Today', count: 14, bg: '#F3E8FF', color: '#6B21A8' },
  ]

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <div style={styles.iconBox}>
            <LifeBuoy style={{ width: 16, height: 16, color: '#2563EB' }} />
          </div>
          <div>
            <h3 style={styles.title}>Help Desk Tickets</h3>
            <p style={styles.subtitle}>Support & bug report tickets</p>
          </div>
        </div>

        <button onClick={onViewAll} style={styles.viewAllBtn}>
          View All
        </button>
      </div>

      <div style={styles.grid}>
        {tickets.map((t, idx) => (
          <div key={idx} style={{ ...styles.tile, background: t.bg }}>
            <span style={{ ...styles.label, color: t.color }}>{t.label}</span>
            <span style={{ ...styles.count, color: t.color }}>{t.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 18,
    padding: '20px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14.5,
    fontWeight: 700,
    color: '#0F172A',
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  viewAllBtn: {
    fontSize: 12,
    fontWeight: 600,
    color: '#2563EB',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
  },
  tile: {
    padding: '12px 10px',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 4,
  },
  count: {
    fontSize: 22,
    fontWeight: 800,
    lineHeight: 1,
  },
}
