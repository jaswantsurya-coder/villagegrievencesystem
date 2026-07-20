import ComplaintTrendChart from '../components/ComplaintTrendChart'
import CategoriesDonutChart from '../components/CategoriesDonutChart'
import StatusDonutChart from '../components/StatusDonutChart'
import BestPerformingVillages from '../components/BestPerformingVillages'
import { BarChart3, TrendingUp, ShieldCheck, Timer } from 'lucide-react'

export default function Analytics() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Platform Analytics</h1>
          <p style={styles.pageSubtitle}>Deep dive SLA performance, resolution speed & regional metrics</p>
        </div>
      </div>

      <div style={styles.metricsRow}>
        <div style={styles.metricCard}>
          <div style={styles.metricTitle}>SLA Success Rate</div>
          <div style={styles.metricValue}>94.2%</div>
          <div style={{ ...styles.metricSub, color: '#15803D' }}>▲ +2.1% this month</div>
        </div>
        <div style={styles.metricCard}>
          <div style={styles.metricTitle}>Resolution Rate</div>
          <div style={styles.metricValue}>87.6%</div>
          <div style={{ ...styles.metricSub, color: '#15803D' }}>▲ +5.3% vs last month</div>
        </div>
        <div style={styles.metricCard}>
          <div style={styles.metricTitle}>Avg Turnaround</div>
          <div style={styles.metricValue}>4.6 Days</div>
          <div style={{ ...styles.metricSub, color: '#15803D' }}>▼ -0.8 days faster</div>
        </div>
        <div style={styles.metricCard}>
          <div style={styles.metricTitle}>Escalation Rate</div>
          <div style={styles.metricValue}>3.0%</div>
          <div style={{ ...styles.metricSub, color: '#15803D' }}>▼ -1.2% reduction</div>
        </div>
      </div>

      <div style={styles.chartsGrid}>
        <div style={{ flex: 1.2, minWidth: 320 }}>
          <ComplaintTrendChart />
        </div>
        <div style={{ flex: 1, minWidth: 300 }}>
          <CategoriesDonutChart />
        </div>
      </div>

      <div style={styles.chartsGrid}>
        <div style={{ flex: 1.2, minWidth: 320 }}>
          <StatusDonutChart />
        </div>
        <div style={{ flex: 1, minWidth: 300 }}>
          <BestPerformingVillages />
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
  metricsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 },
  metricCard: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' },
  metricTitle: { fontSize: 12, fontWeight: 600, color: '#64748B' },
  metricValue: { fontSize: 26, fontWeight: 800, color: '#0F172A', margin: '8px 0 4px' },
  metricSub: { fontSize: 11.5, fontWeight: 700 },
  chartsGrid: { display: 'flex', gap: 16, flexWrap: 'wrap' },
}
