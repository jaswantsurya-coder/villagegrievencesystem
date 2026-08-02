import { usePlatformAnalytics } from '../hooks/usePlatformAnalytics'
import ComplaintTrendChart from '../components/ComplaintTrendChart'
import CategoriesDonutChart from '../components/CategoriesDonutChart'
import StatusDonutChart from '../components/StatusDonutChart'
import BestPerformingVillages from '../components/BestPerformingVillages'
import { UserCheck, RefreshCw, Database } from 'lucide-react'

export default function Analytics() {
  const { loading, analytics, refresh } = usePlatformAnalytics()

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Platform Analytics</h1>
          <p style={styles.pageSubtitle}>
            Live aggregated metrics from Citizen App DB (<code>dtucrczgagpzjbbrwqit</code>) & Admin Requests Portal DB (<code>sompzqwvegygtpsrlhzt</code>)
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          style={styles.refreshBtn}
          className="btn-interactive"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh Analytics'}
        </button>
      </div>

      {/* ─── Admin Request Portal Live Applicants Banner (DB 2: sompzqwvegygtpsrlhzt) ─── */}
      <div style={styles.adminPortalCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={styles.adminPortalIcon}>
            <UserCheck size={20} color="#2563EB" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
              Admin Request Portal Submissions
              <span style={styles.dbTag}>DB: sompzqwvegygtpsrlhzt</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
              Total Member & Village Admin Onboarding Applications
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>{analytics.adminRequestsCount}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>Total Applied</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#D97706' }}>{analytics.adminRequestsPending}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#D97706' }}>Pending</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#15803D' }}>{analytics.adminRequestsApproved}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#15803D' }}>Approved</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#DC2626' }}>{analytics.adminRequestsRejected}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#DC2626' }}>Rejected</div>
          </div>
        </div>
      </div>

      {/* ─── Summary SLA & Performance Cards (DB 1: dtucrczgagpzjbbrwqit) ─── */}
      <div style={styles.metricsRow}>
        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <div style={styles.metricTitle}>SLA Success Rate</div>
            <span style={styles.liveTag}>LIVE</span>
          </div>
          <div style={styles.metricValue}>{analytics.slaSuccessRate}%</div>
          <div style={{ ...styles.metricSub, color: parseFloat(analytics.slaSuccessRate) >= 90 ? '#15803D' : '#D97706' }}>
            ● Based on {analytics.totalComplaints} total complaints
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <div style={styles.metricTitle}>Resolution Rate</div>
            <span style={styles.liveTag}>LIVE</span>
          </div>
          <div style={styles.metricValue}>{analytics.resolutionRate}%</div>
          <div style={{ ...styles.metricSub, color: '#15803D' }}>
            ● {analytics.resolvedComplaints} of {analytics.totalComplaints} complaints resolved
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <div style={styles.metricTitle}>Avg Turnaround</div>
            <span style={styles.liveTag}>LIVE</span>
          </div>
          <div style={styles.metricValue}>{analytics.avgTurnaroundDays} <span style={{ fontSize: 14, color: '#64748B' }}>Days</span></div>
          <div style={{ ...styles.metricSub, color: '#2563EB' }}>
            ● Computed from resolution timestamps
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <div style={styles.metricTitle}>Escalation Rate</div>
            <span style={styles.liveTag}>LIVE</span>
          </div>
          <div style={styles.metricValue}>{analytics.escalationRate}%</div>
          <div style={{ ...styles.metricSub, color: parseFloat(analytics.escalationRate) > 5 ? '#DC2626' : '#15803D' }}>
            ● {analytics.escalatedComplaints} escalated issues
          </div>
        </div>
      </div>

      {/* ─── Real Charts Grid ─── */}
      <div style={styles.chartsGrid}>
        <div style={{ flex: 1.2, minWidth: 320 }}>
          <ComplaintTrendChart trendData={analytics.trendData} />
        </div>
        <div style={{ flex: 1, minWidth: 300 }}>
          <CategoriesDonutChart categoryData={analytics.categoryData} totalComplaints={analytics.totalComplaints} />
        </div>
      </div>

      <div style={styles.chartsGrid}>
        <div style={{ flex: 1.2, minWidth: 320 }}>
          <StatusDonutChart
            statusData={analytics.statusData}
            totalComplaints={analytics.totalComplaints}
            avgTurnaroundDays={analytics.avgTurnaroundDays}
          />
        </div>
        <div style={{ flex: 1, minWidth: 300 }}>
          <BestPerformingVillages bestVillages={analytics.bestVillages} />
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: 18 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { fontSize: 22, fontWeight: 800, color: '#0F172A' },
  pageSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4 },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    borderRadius: 10,
    background: '#F1F5F9',
    color: '#0F172A',
    border: '1px solid #CBD5E1',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  },
  adminPortalCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 16,
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justify: 'space-between',
    flexWrap: 'wrap',
    gap: 14,
    boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
  },
  adminPortalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dbTag: {
    fontSize: 9.5,
    fontWeight: 800,
    background: '#E0E7FF',
    color: '#3730A3',
    padding: '2px 6px',
    borderRadius: 4,
  },
  metricsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 },
  metricCard: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' },
  metricHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  metricTitle: { fontSize: 12, fontWeight: 600, color: '#64748B' },
  liveTag: { fontSize: 9, fontWeight: 800, background: '#DCFCE7', color: '#15803D', padding: '1px 5px', borderRadius: 4 },
  metricValue: { fontSize: 26, fontWeight: 800, color: '#0F172A', margin: '8px 0 4px' },
  metricSub: { fontSize: 11, fontWeight: 700 },
  chartsGrid: { display: 'flex', gap: 16, flexWrap: 'wrap' },
}
