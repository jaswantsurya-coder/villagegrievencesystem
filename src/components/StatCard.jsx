import { TrendingUp, TrendingDown } from 'lucide-react'

export default function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendType = 'up',
  icon: Icon,
  iconBg = '#EFF6FF',
  iconColor = '#2563EB',
  badgeText,
  badgeBg,
  badgeColor,
  sparklineData = [12, 18, 15, 25, 22, 30, 28, 38, 35, 45],
  sparklineColor = '#3B82F6',
}) {
  // Generate SVG path for sparkline
  const width = 100
  const height = 28
  const max = Math.max(...sparklineData, 1)
  const min = Math.min(...sparklineData, 0)
  const range = max - min || 1
  
  const points = sparklineData
    .map((val, i) => {
      const x = (i / (sparklineData.length - 1)) * width
      const y = height - ((val - min) / range) * (height - 6) - 3
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' L ')

  const pathD = `M ${points}`
  const areaD = `M 0,${height} L ${points} L ${width},${height} Z`

  return (
    <div style={styles.card} className="stat-card-container">
      {/* Top Header Row */}
      <div style={styles.topRow}>
        <div style={{ ...styles.iconBox, background: iconBg, color: iconColor }}>
          {Icon && <Icon style={{ width: 18, height: 18 }} />}
        </div>
        
        <div style={styles.titleGroup}>
          <span style={styles.cardTitle}>{title}</span>
        </div>

        {badgeText && (
          <span
            style={{
              ...styles.badge,
              background: badgeBg || '#EFF6FF',
              color: badgeColor || '#2563EB',
            }}
          >
            {badgeText}
          </span>
        )}
      </div>

      {/* Main Metric & Sparkline Row */}
      <div style={styles.middleRow}>
        <div style={styles.valueGroup}>
          <span style={styles.value}>{value}</span>
        </div>

        {/* Mini Sparkline Chart */}
        <div style={styles.sparklineContainer}>
          <svg width={width} height={height} style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id={`grad-${title.replace(/\s+/g, '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={sparklineColor} stopOpacity="0.25" />
                <stop offset="100%" stopColor={sparklineColor} stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={areaD} fill={`url(#grad-${title.replace(/\s+/g, '')})`} />
            <path d={pathD} fill="none" stroke={sparklineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Bottom Subtitle / Trend Row */}
      <div style={styles.bottomRow}>
        {trend && (
          <span
            style={{
              ...styles.trendTag,
              background: trendType === 'up' ? '#DCFCE7' : trendType === 'down' ? '#FEE2E2' : '#F1F5F9',
              color: trendType === 'up' ? '#15803D' : trendType === 'down' ? '#B91C1C' : '#475569',
            }}
          >
            {trendType === 'up' && <TrendingUp style={{ width: 12, height: 12 }} />}
            {trendType === 'down' && <TrendingDown style={{ width: 12, height: 12 }} />}
            {trend}
          </span>
        )}

        {subtitle && <span style={styles.subtitle}>{subtitle}</span>}
      </div>
    </div>
  )
}

const styles = {
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 18,
    padding: '16px 18px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
    overflow: 'hidden',
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.6)',
  },
  titleGroup: {
    flex: 1,
    paddingLeft: 4,
  },
  cardTitle: {
    fontSize: 12.5,
    fontWeight: 600,
    color: '#64748B',
    lineHeight: 1.2,
  },
  badge: {
    fontSize: 10.5,
    fontWeight: 700,
    borderRadius: 6,
    padding: '2px 8px',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },
  middleRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    margin: '12px 0 8px',
  },
  valueGroup: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: 800,
    color: '#0F172A',
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  sparklineContainer: {
    width: 90,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bottomRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  trendTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 6,
    padding: '2px 6px',
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: 500,
  },
}
