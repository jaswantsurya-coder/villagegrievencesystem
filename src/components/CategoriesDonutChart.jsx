import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { BarChart3 } from 'lucide-react'

const data = [
  { name: 'Roads & Infrastructure', value: 32.4, color: '#2563EB' },
  { name: 'Water Supply', value: 18.7, color: '#38BDF8' },
  { name: 'Drainage & Sewage', value: 14.8, color: '#34D399' },
  { name: 'Electricity', value: 12.1, color: '#F59E0B' },
  { name: 'Street Lights', value: 8.6, color: '#8B5CF6' },
  { name: 'Sanitation', value: 6.2, color: '#EC4899' },
  { name: 'Others', value: 7.2, color: '#94A3B8' },
]

export default function CategoriesDonutChart({ totalComplaints = 18573 }) {
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <div style={styles.iconBox}>
            <BarChart3 style={{ width: 16, height: 16, color: '#2563EB' }} />
          </div>
          <div>
            <h3 style={styles.title}>Top Complaint Categories</h3>
            <p style={styles.subtitle}>Distribution by issue classification</p>
          </div>
        </div>
      </div>

      <div style={styles.contentRow}>
        <div style={{ width: 140, height: 140, position: 'relative', flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                innerRadius={44}
                outerRadius={66}
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
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
              {totalComplaints.toLocaleString()}
            </div>
            <div style={{ fontSize: 9.5, color: '#64748B', fontWeight: 600, marginTop: 2 }}>
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
  contentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
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
    gap: 5,
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
    overflow: 'hidden',
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
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  legendVal: {
    fontWeight: 700,
    color: '#0F172A',
  },
}
