import { X, ExternalLink, TrendingUp, ShieldCheck, Building2, Users, AlertCircle, Award } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function StatDetailModal({ data, onClose }) {
  const navigate = useNavigate()

  if (!data) return null

  const { title, value, subtitle, icon: Icon, iconBg, iconColor, targetPath, details } = data

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitleGroup}>
            <div style={{ ...styles.iconBox, background: iconBg || '#EFF6FF', color: iconColor || '#2563EB' }}>
              {Icon && <Icon style={{ width: 20, height: 20 }} />}
            </div>
            <div>
              <h3 style={styles.modalTitle}>{title}</h3>
              <p style={styles.modalSubtitle}>Realtime GramSeva Platform Telemetry</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Content Body */}
        <div style={styles.body}>
          <div style={styles.mainMetricCard}>
            <div style={styles.metricLabel}>Current Metric Value</div>
            <div style={styles.bigValue}>{value}</div>
            {subtitle && <div style={styles.metricSubtitle}>{subtitle}</div>}
          </div>

          <div style={styles.sectionTitle}>Breakdown & Insights</div>
          <div style={styles.detailsList}>
            {details?.map((d, idx) => (
              <div key={idx} style={styles.detailRow}>
                <span style={styles.detailLabel}>{d.label}</span>
                <strong style={styles.detailVal}>{d.value}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>
            Close
          </button>

          {targetPath && (
            <button
              onClick={() => {
                onClose()
                navigate(targetPath)
              }}
              style={styles.navigateBtn}
              className="btn-interactive"
            >
              Open {title} Module <ExternalLink style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(15, 23, 42, 0.5)',
    backdropFilter: 'blur(4px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    background: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748B',
    background: '#F8FAFC',
  },
  body: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  mainMetricCard: {
    background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
    border: '1px solid #DBEAFE',
    borderRadius: 14,
    padding: '16px 20px',
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    color: '#64748B',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  bigValue: {
    fontSize: 32,
    fontWeight: 800,
    color: '#0F172A',
    margin: '4px 0',
  },
  metricSubtitle: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: 600,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    color: '#94A3B8',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  detailsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: '#F8FAFC',
    border: '1px solid #F1F5F9',
    borderRadius: 10,
    fontSize: 12.5,
  },
  detailLabel: {
    color: '#64748B',
  },
  detailVal: {
    color: '#0F172A',
    fontWeight: 700,
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#F8FAFC',
  },
  cancelBtn: {
    padding: '9px 16px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    color: '#64748B',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
  },
  navigateBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 18px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    color: '#FFFFFF',
    background: '#2563EB',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
  },
}
