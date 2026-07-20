import { AlertCircle, ShieldCheck, CheckCircle2, Building2, FileText, Activity } from 'lucide-react'

const activities = [
  {
    time: '09:41 AM',
    title: 'Complaint filed',
    desc: 'Road damage near school, Ward 5',
    tag: 'Vizianagaram',
    icon: AlertCircle,
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    time: '09:39 AM',
    title: 'Officer assigned',
    desc: 'Complaint #GS-2025-18573',
    tag: 'Srikakulam',
    icon: ShieldCheck,
    color: '#8B5CF6',
    bg: '#F3E8FF',
  },
  {
    time: '09:35 AM',
    title: 'Status updated',
    desc: 'In progress → Resolved',
    tag: 'West Godavari',
    icon: CheckCircle2,
    color: '#166534',
    bg: '#DCFCE7',
  },
  {
    time: '09:32 AM',
    title: 'Village joined',
    desc: 'New village registered',
    tag: 'YSR Kadapa',
    icon: Building2,
    color: '#0284C7',
    bg: '#E0F2FE',
  },
  {
    time: '09:28 AM',
    title: 'Admin request submitted',
    desc: 'New sarpanch request received',
    tag: 'Krishna',
    icon: FileText,
    color: '#D97706',
    bg: '#FEF3C7',
  },
]

export default function LiveActivityFeed() {
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <div style={styles.iconBox}>
            <Activity style={{ width: 16, height: 16, color: '#2563EB' }} />
          </div>
          <div>
            <h3 style={styles.title}>Live Activity Feed</h3>
            <p style={styles.subtitle}>Realtime platform events</p>
          </div>
        </div>

        <span style={styles.liveBadge}>
          <span style={styles.greenDot} className="pulse-dot" /> Live
        </span>
      </div>

      <div style={styles.feedList}>
        {activities.map((item, idx) => {
          const Icon = item.icon
          return (
            <div key={idx} style={styles.feedItem}>
              <span style={styles.time}>{item.time}</span>

              <div style={{ ...styles.itemIconBox, background: item.bg, color: item.color }}>
                <Icon style={{ width: 13, height: 13 }} />
              </div>

              <div style={styles.content}>
                <div style={styles.itemTitle}>{item.title}</div>
                <div style={styles.itemDesc}>{item.desc}</div>
              </div>

              <span style={styles.locationTag}>{item.tag}</span>
            </div>
          )
        })}
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
  liveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 99,
    background: '#DCFCE7',
    color: '#15803D',
    fontSize: 11,
    fontWeight: 700,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    background: '#22C55E',
  },
  feedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  feedItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 12,
  },
  time: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: '#94A3B8',
    width: 60,
    flexShrink: 0,
    fontWeight: 500,
  },
  itemIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  itemTitle: {
    fontWeight: 700,
    color: '#0F172A',
    fontSize: 12,
  },
  itemDesc: {
    color: '#64748B',
    fontSize: 11,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  locationTag: {
    fontSize: 10.5,
    fontWeight: 600,
    color: '#475569',
    background: '#F1F5F9',
    borderRadius: 6,
    padding: '2px 8px',
    whiteSpace: 'nowrap',
  },
}
