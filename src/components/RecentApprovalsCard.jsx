import { BadgeCheck, CheckCircle2 } from 'lucide-react'

const approvals = [
  { applicant: 'Madhava Rao', village: 'Addategala', district: 'Prakasam', time: '16 May, 04:21 PM' },
  { applicant: 'Jyothi Prakash', village: 'Duggirala', district: 'Guntur', time: '16 May, 03:42 PM' },
  { applicant: 'Ravi Teja', village: 'Peddapuram', district: 'Kakinada', time: '16 May, 02:15 PM' },
]

export default function RecentApprovalsCard({ onViewAll }) {
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <div style={styles.iconBox}>
            <BadgeCheck style={{ width: 16, height: 16, color: '#166534' }} />
          </div>
          <div>
            <h3 style={styles.title}>Recent Admin Approvals</h3>
            <p style={styles.subtitle}>Verified sarpanch credentials</p>
          </div>
        </div>

        <button onClick={onViewAll} style={styles.viewAllBtn}>
          View All
        </button>
      </div>

      <div style={styles.list}>
        {approvals.map((item, idx) => (
          <div key={idx} style={styles.listItem}>
            <div style={styles.userAvatar}>
              {item.applicant.split(' ').map(n => n[0]).join('')}
            </div>

            <div style={styles.userInfo}>
              <div style={styles.name}>{item.applicant}</div>
              <div style={styles.meta}>
                {item.village}, {item.district}
              </div>
            </div>

            <div style={styles.rightGroup}>
              <span style={styles.time}>{item.time}</span>
              <span style={styles.approvedBadge}>
                <CheckCircle2 style={{ width: 11, height: 11 }} /> Approved
              </span>
            </div>
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
    marginBottom: 14,
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
    background: '#DCFCE7',
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
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 10,
    background: '#F8FAFC',
    border: '1px solid #F1F5F9',
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: 99,
    background: '#DBEAFE',
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    overflow: 'hidden',
  },
  name: {
    fontSize: 12,
    fontWeight: 700,
    color: '#0F172A',
    lineHeight: 1.2,
  },
  meta: {
    fontSize: 11,
    color: '#64748B',
  },
  rightGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
  },
  time: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontFamily: 'var(--font-mono)',
  },
  approvedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontSize: 10.5,
    fontWeight: 700,
    color: '#15803D',
    background: '#DCFCE7',
    borderRadius: 6,
    padding: '1px 6px',
  },
}
