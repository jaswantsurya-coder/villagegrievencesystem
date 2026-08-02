import { Award, ShieldCheck, Trophy } from 'lucide-react'

export default function BestPerformingVillages({ bestVillages = [], onViewAll }) {
  const topVillages = bestVillages.length > 0 ? bestVillages : [
    { village: 'Vizianagaram', district: 'Vizianagaram', resolutionRate: 100, solved: 1, score: 100, isTop: true },
    { village: 'Visakhapatnam', district: 'Visakhapatnam', resolutionRate: 100, solved: 0, score: 100 },
  ]
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <div style={styles.iconBox}>
            <Award style={{ width: 16, height: 16, color: '#2563EB' }} />
          </div>
          <div>
            <h3 style={styles.title}>Best Performing Villages</h3>
            <p style={styles.subtitle}>Top resolution scores & SLAs</p>
          </div>
        </div>

        <button onClick={onViewAll} style={styles.viewAllBtn}>
          View All
        </button>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Village</th>
              <th style={styles.th}>District</th>
              <th style={styles.th}>Resolution %</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Complaints Solved</th>
              <th style={{ ...styles.th, textAlign: 'center' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {topVillages.map((item, idx) => (
              <tr key={idx} style={styles.tr}>
                <td style={styles.tdBold}>{item.village}</td>
                <td style={styles.tdMuted}>{item.district}</td>
                <td style={styles.td}>
                  <div style={styles.barGroup}>
                    <div style={styles.barBg}>
                      <div style={{ ...styles.barFill, width: `${item.resolutionRate}%` }} />
                    </div>
                    <span style={styles.barText}>{item.resolutionRate}%</span>
                  </div>
                </td>
                <td style={{ ...styles.tdBold, textAlign: 'right' }}>{item.solved}</td>
                <td style={{ ...styles.td, textAlign: 'center' }}>
                  <span style={styles.scoreBadge}>
                    {item.score}
                    {item.isTop ? (
                      <Trophy style={{ width: 12, height: 12, color: '#D97706', marginLeft: 4 }} />
                    ) : (
                      <ShieldCheck style={{ width: 12, height: 12, color: '#166534', marginLeft: 4 }} />
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
  },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    fontSize: 10.5,
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #E2E8F0',
  },
  tr: {
    borderBottom: '1px solid #F1F5F9',
  },
  td: {
    padding: '10px 10px',
    color: '#0F172A',
  },
  tdBold: {
    padding: '10px 10px',
    fontWeight: 700,
    color: '#0F172A',
  },
  tdMuted: {
    padding: '10px 10px',
    color: '#64748B',
  },
  barGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  barBg: {
    flex: 1,
    height: 6,
    background: '#E2E8F0',
    borderRadius: 99,
    overflow: 'hidden',
    minWidth: 50,
  },
  barFill: {
    height: '100%',
    background: '#22C55E',
    borderRadius: 99,
  },
  barText: {
    fontSize: 11,
    fontWeight: 700,
    color: '#15803D',
    minWidth: 30,
  },
  scoreBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    fontSize: 11.5,
    fontWeight: 800,
    color: '#0F172A',
  },
}
