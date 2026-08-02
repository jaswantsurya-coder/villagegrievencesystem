import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BadgeCheck, CheckCircle2 } from 'lucide-react'

export default function RecentApprovalsCard({ onViewAll }) {
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchApprovedRequests()
  }, [])

  async function fetchApprovedRequests() {
    setLoading(true)
    try {
      // Query DB2 (sompzqwvegygtpsrlhzt) for real approved admin requests
      const { data } = await supabase
        .from('admin_requests')
        .select('*')
        .eq('status', 'approved')
        .order('reviewed_at', { ascending: false })
        .limit(3)

      if (data && data.length > 0) {
        setApprovals(
          data.map((item) => ({
            id: item.id,
            applicant: item.full_name || 'Sarpanch Applicant',
            village: item.village_name || 'Panchayat',
            district: item.district || 'District',
            time: item.reviewed_at
              ? new Date(item.reviewed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
              : 'Recently',
          }))
        )
      } else {
        setApprovals([])
      }
    } catch (err) {
      console.error('Error fetching approved admin requests:', err)
      setApprovals([])
    } finally {
      setLoading(false)
    }
  }

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

        <button onClick={onViewAll} style={styles.viewAllBtn} className="btn-interactive">
          View All
        </button>
      </div>

      <div style={styles.list}>
        {loading ? (
          <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: '#64748B' }}>
            Loading approvals...
          </div>
        ) : approvals.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>
            No verified sarpanch credentials approved yet.
          </div>
        ) : (
          approvals.map((item) => (
            <div key={item.id} style={styles.listItem}>
              <div style={styles.userAvatar}>
                {item.applicant.split(' ').map((n) => n[0]).join('').slice(0, 2)}
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
          ))
        )}
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
    gap: 12,
    padding: '10px 12px',
    borderRadius: 12,
    background: '#F8FAFC',
    border: '1px solid #F1F5F9',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#DBEAFE',
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textTransform: 'uppercase',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 12.5,
    fontWeight: 700,
    color: '#0F172A',
  },
  meta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  rightGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  time: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: 600,
  },
  approvedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 12,
    background: '#DCFCE7',
    color: '#15803D',
    fontSize: 10.5,
    fontWeight: 700,
  },
}
