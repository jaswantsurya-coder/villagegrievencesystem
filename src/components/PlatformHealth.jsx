import { Activity, Database, HardDrive, Cpu, Radio, Send } from 'lucide-react'

export default function PlatformHealth() {
  const items = [
    { label: 'API', status: 'Healthy', icon: Activity },
    { label: 'Database', status: 'Healthy', icon: Database },
    { label: 'Storage', status: 'Healthy', icon: HardDrive },
    { label: 'AI Model', status: 'Healthy', icon: Cpu },
    { label: 'Realtime', status: 'Connected', icon: Radio },
    { label: 'SMTP', status: 'Connected', icon: Send },
  ]

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <div style={styles.iconBox}>
            <Activity style={{ width: 16, height: 16, color: '#2563EB' }} />
          </div>
          <span style={styles.title}>Platform Health</span>
        </div>
        <span style={styles.operationalBadge}>
          <span style={styles.greenDot} className="pulse-dot" /> All Systems Operational
        </span>
      </div>

      <div style={styles.grid}>
        {items.map((item, idx) => {
          const Icon = item.icon
          return (
            <div key={idx} style={styles.itemCard}>
              <div style={styles.itemLeft}>
                <span style={styles.dot} />
                <div>
                  <div style={styles.itemLabel}>{item.label}</div>
                  <div style={styles.itemStatus}>{item.status}</div>
                </div>
              </div>
              <Icon style={{ width: 14, height: 14, color: '#94A3B8' }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

const styles = {
  container: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 18,
    padding: '16px 20px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0F172A',
  },
  operationalBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 99,
    background: '#DCFCE7',
    color: '#15803D',
    fontSize: 11.5,
    fontWeight: 700,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    background: '#22C55E',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  itemCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    background: '#F8FAFC',
    border: '1px solid #F1F5F9',
    borderRadius: 10,
  },
  itemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    background: '#22C55E',
    flexShrink: 0,
  },
  itemLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#475569',
    lineHeight: 1.1,
  },
  itemStatus: {
    fontSize: 10.5,
    fontWeight: 700,
    color: '#15803D',
    lineHeight: 1.1,
  },
}
