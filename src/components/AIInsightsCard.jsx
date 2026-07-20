import { Sparkles, TrendingUp, AlertTriangle, Clock } from 'lucide-react'

export default function AIInsightsCard() {
  const cards = [
    {
      title: 'Most Common',
      value: 'Roads & Infra',
      subtitle: '32.4% of complaints',
      bg: '#EFF6FF',
      titleColor: '#1D4ED8',
    },
    {
      title: 'Predicted Increase',
      value: 'Water Supply',
      subtitle: '+18% next month',
      bg: '#FEF3C7',
      titleColor: '#B45309',
      icon: TrendingUp,
    },
    {
      title: 'High Risk Villages',
      value: '8 Villages',
      subtitle: 'Need attention',
      bg: '#FEE2E2',
      titleColor: '#B91C1C',
      icon: AlertTriangle,
    },
    {
      title: 'Avg Resolution Time',
      value: '4.6 Days',
      subtitle: '▼ 0.8 days',
      bg: '#DCFCE7',
      titleColor: '#15803D',
      icon: Clock,
    },
  ]

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <div style={styles.iconBox}>
            <Sparkles style={{ width: 16, height: 16, color: '#2563EB' }} />
          </div>
          <div>
            <h3 style={styles.title}>AI Insights (Coming Soon)</h3>
            <p style={styles.subtitle}>Predictive intelligence & NLP telemetry</p>
          </div>
        </div>
      </div>

      <div style={styles.cardsGrid}>
        {cards.map((c, idx) => (
          <div key={idx} style={{ ...styles.card, background: c.bg }}>
            <div style={{ ...styles.cardTag, color: c.titleColor }}>{c.title}</div>
            <div style={styles.cardValue}>{c.value}</div>
            <div style={styles.cardSubtitle}>{c.subtitle}</div>
          </div>
        ))}

        {/* AI Banner Card */}
        <div style={styles.bannerCard}>
          <Sparkles style={{ width: 20, height: 20, color: '#2563EB', marginBottom: 4 }} />
          <div style={styles.bannerTitle}>AI Analysis Coming Soon</div>
          <div style={styles.bannerDesc}>Advanced insights and predictions</div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
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
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 8,
  },
  card: {
    padding: '10px 8px',
    borderRadius: 10,
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTag: {
    fontSize: 9.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 12,
    fontWeight: 800,
    color: '#0F172A',
    lineHeight: 1.1,
  },
  cardSubtitle: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  bannerCard: {
    background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
    border: '1px dashed #93C5FD',
    borderRadius: 10,
    padding: '10px 8px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 10.5,
    fontWeight: 800,
    color: '#1D4ED8',
    lineHeight: 1.2,
  },
  bannerDesc: {
    fontSize: 9,
    color: '#3B82F6',
    marginTop: 2,
  },
}
