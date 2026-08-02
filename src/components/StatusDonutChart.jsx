import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { Clock, ArrowDownRight, Zap, RotateCcw } from 'lucide-react'

export default function StatusDonutChart({ statusData = [], totalComplaints = 0, avgTurnaroundDays = 0 }) {
  const data = statusData.length > 0 ? statusData : [
    { name: 'Open', value: 0, color: '#3B82F6' },
    { name: 'In Progress', value: 0, color: '#F59E0B' },
    { name: 'Resolved', value: 0, color: '#22C55E' },
    { name: 'Escalated', value: 0, color: '#EF4444' },
  ]
  return (
    <div style={styles.grid}>
      {/* Donut Chart Card */}
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.titleGroup}>
            <div style={styles.iconBox}>
              <RotateCcw style={{ width: 16, height: 16, color: '#2563EB' }} />
            </div>
            <div>
              <h3 style={styles.title}>Complaint Status</h3>
              <p style={styles.subtitle}>Current resolution breakdown</p>
            </div>
          </div>
        </div>

        <div style={styles.contentRow}>
          <div style={{ width: 130, height: 130, position: 'relative', flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => `${val}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div style={styles.centerLabel}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
                {totalComplaints.toLocaleString()}
              </div>
              <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, marginTop: 2 }}>
                Total
              </div>
            </div>
          </div>

          <div style={styles.legend}>
            {data.map((item, idx) => (
              <div key={idx} style={styles.legendItem}>
                <div style={styles.legendLeft}>
                  <span style={{ ...styles.colorDot, background: item.color }} />
                  <span style={styles.legendName}>{item.name}</span>
                </div>
                <span style={styles.legendVal}>{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Average Resolution Time Card */}
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.titleGroup}>
            <div style={{ ...styles.iconBox, background: '#DCFCE7' }}>
              <Clock style={{ width: 16, height: 16, color: '#166534' }} />
            </div>
            <div>
              <h3 style={styles.title}>Average Resolution Time</h3>
              <p style={styles.subtitle}>SLA delivery speed</p>
            </div>
          </div>
        </div>

        <div style={styles.resolutionBody}>
          <div style={styles.bigTime}>
            {avgTurnaroundDays} <span style={{ fontSize: 16, fontWeight: 600, color: '#64748B' }}>Days</span>
          </div>

          <div style={styles.resolutionTrend}>
            <span style={styles.greenBadge}>
              <ArrowDownRight style={{ width: 13, height: 13, color: '#15803D' }} />
              0.8 days
            </span>
            <span style={{ color: '#64748B', fontWeight: 500 }}>vs last month</span>
          </div>

          <div style={styles.extremesBox}>
            <div style={styles.extremeRow}>
              <Zap style={{ width: 13, height: 13, color: '#166534' }} />
              <span style={{ color: '#64748B' }}>Fastest Village:</span>
              <strong style={{ color: '#166534', marginLeft: 'auto' }}>Bhimavaram (1.8 Days)</strong>
            </div>

            <div style={styles.extremeRow}>
              <Clock style={{ width: 13, height: 13, color: '#991B1B' }} />
              <span style={{ color: '#64748B' }}>Slowest Village:</span>
              <strong style={{ color: '#991B1B', marginLeft: 'auto' }}>Srikakulam Rural (7.9 Days)</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
    height: '100%',
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 18,
    padding: '20px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: 10,
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
    fontSize: 14,
    fontWeight: 700,
    color: '#0F172A',
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  contentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  centerLabel: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  legend: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 11,
  },
  legendLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    flexShrink: 0,
  },
  legendName: {
    color: '#475569',
    fontWeight: 500,
  },
  legendVal: {
    fontWeight: 700,
    color: '#0F172A',
  },
  resolutionBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  bigTime: {
    fontSize: 28,
    fontWeight: 800,
    color: '#0F172A',
    lineHeight: 1,
  },
  resolutionTrend: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
  },
  greenBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: '#DCFCE7',
    color: '#15803D',
    fontWeight: 700,
    fontSize: 11,
    borderRadius: 6,
    padding: '2px 6px',
  },
  extremesBox: {
    marginTop: 8,
    paddingTop: 10,
    borderTop: '1px solid #F1F5F9',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 11.5,
  },
  extremeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
}
