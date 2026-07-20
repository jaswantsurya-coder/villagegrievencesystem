import { Bot, ServerCog, HardDrive, Sparkles, Cpu, Activity, Database, CheckCircle2 } from 'lucide-react'

export default function AIInsights() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>AI Engine & Infrastructure</h1>
          <p style={styles.pageSubtitle}>Realtime inference telemetry & Cloud telemetry</p>
        </div>
      </div>

      <div style={styles.gridThree}>
        {/* AI Engine Status Card */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={{ ...styles.iconBox, background: '#EFF6FF' }}>
              <Bot style={{ width: 18, height: 18, color: '#2563EB' }} />
            </div>
            <div>
              <h3 style={styles.cardTitle}>AI Engine Status</h3>
              <p style={styles.cardSubtitle}>NLP Complaint Classifier</p>
            </div>
            <span style={styles.onlineBadge}>● Online</span>
          </div>

          <div style={styles.specsGrid}>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Model</span>
              <strong style={styles.specVal}>Qwen2.5-1.5B Fine-tuned</strong>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Execution Mode</span>
              <strong style={styles.specVal}>CPU Optimized</strong>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Inference Health</span>
              <strong style={{ ...styles.specVal, color: '#15803D' }}>Healthy</strong>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Avg Latency</span>
              <strong style={styles.specVal}>320 ms</strong>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Active Queue</span>
              <strong style={styles.specVal}>2 Requests</strong>
            </div>
          </div>
        </div>

        {/* Cloud Infrastructure Card */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={{ ...styles.iconBox, background: '#F3E8FF' }}>
              <ServerCog style={{ width: 18, height: 18, color: '#8B5CF6' }} />
            </div>
            <div>
              <h3 style={styles.cardTitle}>Cloud Infrastructure</h3>
              <p style={styles.cardSubtitle}>Oracle Cloud Compute</p>
            </div>
          </div>

          <div style={styles.meterList}>
            <div style={styles.meterItem}>
              <div style={styles.meterHeader}>
                <span>CPU Usage</span>
                <strong>18%</strong>
              </div>
              <div style={styles.barBg}>
                <div style={{ ...styles.barFill, width: '18%', background: '#2563EB' }} />
              </div>
            </div>

            <div style={styles.meterItem}>
              <div style={styles.meterHeader}>
                <span>RAM Usage</span>
                <strong>39%</strong>
              </div>
              <div style={styles.barBg}>
                <div style={{ ...styles.barFill, width: '39%', background: '#3B82F6' }} />
              </div>
            </div>

            <div style={styles.meterItem}>
              <div style={styles.meterHeader}>
                <span>Storage Used</span>
                <strong>28%</strong>
              </div>
              <div style={styles.barBg}>
                <div style={{ ...styles.barFill, width: '28%', background: '#22C55E' }} />
              </div>
            </div>

            <div style={styles.statusRow}>
              <span>FastAPI Backend: <strong style={{ color: '#15803D' }}>Running</strong></span>
              <span>Supabase: <strong style={{ color: '#15803D' }}>Connected</strong></span>
            </div>
          </div>
        </div>

        {/* Storage Analytics Card */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={{ ...styles.iconBox, background: '#DCFCE7' }}>
              <HardDrive style={{ width: 18, height: 18, color: '#166534' }} />
            </div>
            <div>
              <h3 style={styles.cardTitle}>Storage Analytics</h3>
              <p style={styles.cardSubtitle}>Bucket quotas & media</p>
            </div>
          </div>

          <div style={styles.specsGrid}>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Complaint Images</span>
              <strong style={styles.specVal}>14,280 Uploads</strong>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Admin Proofs</span>
              <strong style={styles.specVal}>1,040 Docs</strong>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Storage Used</span>
              <strong style={styles.specVal}>280 GB / 1000 GB</strong>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Daily Upload Rate</span>
              <strong style={styles.specVal}>~4.2 GB / day</strong>
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights Placeholders */}
      <div style={styles.aiBanner}>
        <Sparkles style={{ width: 24, height: 24, color: '#2563EB' }} />
        <div>
          <h3 style={styles.aiBannerTitle}>AI Predictive Engine Coming Soon</h3>
          <p style={styles.aiBannerDesc}>
            NLP sentiment analysis, automated priority assignment, and high-risk village predictive engines are currently under training.
          </p>
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
  gridThree: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 18, padding: '20px', boxShadow: '0 1px 3px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  iconBox: { width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14.5, fontWeight: 700, color: '#0F172A' },
  cardSubtitle: { fontSize: 11.5, color: '#64748B' },
  onlineBadge: { marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#15803D', background: '#DCFCE7', padding: '3px 8px', borderRadius: 99 },
  specsGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  specItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, borderBottom: '1px solid #F1F5F9', paddingBottom: 6 },
  specLabel: { color: '#64748B' },
  specVal: { color: '#0F172A', fontWeight: 700 },
  meterList: { display: 'flex', flexDirection: 'column', gap: 12 },
  meterItem: { display: 'flex', flexDirection: 'column', gap: 4 },
  meterHeader: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B' },
  barBg: { height: 8, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99 },
  statusRow: { display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#64748B', paddingTop: 8, borderTop: '1px solid #F1F5F9' },
  aiBanner: { background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', border: '1px dashed #93C5FD', borderRadius: 18, padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 16 },
  aiBannerTitle: { fontSize: 16, fontWeight: 800, color: '#1D4ED8' },
  aiBannerDesc: { fontSize: 13, color: '#3B82F6', marginTop: 4 },
}
