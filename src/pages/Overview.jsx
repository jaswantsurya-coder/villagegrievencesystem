import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Overview() {
  const [villages, setVillages] = useState([])
  const [stats, setStats] = useState({ villages: 0, pending: 0, complaints: 0, escalated: 0 })
  const [recentRequests, setRecentRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [villagesRes, pendingRes, complaintsRes, escalatedRes, requestsRes] = await Promise.all([
        supabase.from('villages').select('id, village_name, district, join_code').order('village_name'),
        supabase.from('admin_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('complaints').select('id', { count: 'exact', head: true }),
        supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('is_escalated', true),
        supabase
          .from('admin_requests')
          .select('id, village_name, district, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      if (villagesRes.error) throw villagesRes.error

      setVillages(villagesRes.data || [])
      setStats({
        villages: villagesRes.data?.length || 0,
        pending: pendingRes.count || 0,
        complaints: complaintsRes.count || 0,
        escalated: escalatedRes.count || 0,
      })
      setRecentRequests(requestsRes.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <header style={{ marginBottom: 28 }}>
        <p className="eyebrow">admin.gramseva.in &middot; overview</p>
        <h1 style={styles.pageTitle}>Platform Register</h1>
      </header>

      {error && <div style={styles.errorBanner}>{error}</div>}

      <section style={{ marginBottom: 36 }}>
        <p style={styles.sectionLabel}>Village Ledger &middot; {stats.villages} registered</p>
        <div style={styles.ledgerStrip}>
          {loading && <span style={styles.muted}>Loading…</span>}
          {!loading && villages.length === 0 && (
            <span style={styles.muted}>No villages registered yet.</span>
          )}
          {villages.map((v) => (
            <div key={v.id} style={styles.seal} title={`${v.village_name}, ${v.district}`}>
              <div style={styles.sealMonogram}>{v.join_code?.slice(0, 3) || '—'}</div>
              <div style={styles.sealName}>{v.village_name}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.statGrid}>
        <StatCard label="Villages registered" value={stats.villages} />
        <StatCard label="Pending approvals" value={stats.pending} accent={stats.pending > 0} />
        <StatCard label="Total complaints" value={stats.complaints} />
        <StatCard label="Escalated (overdue)" value={stats.escalated} accent={stats.escalated > 0} />
      </section>

      <section style={{ marginTop: 36 }}>
        <p style={styles.sectionLabel}>Recent admin requests</p>
        <div style={styles.table}>
          {recentRequests.length === 0 && !loading && (
            <p style={styles.muted}>No requests submitted yet.</p>
          )}
          {recentRequests.map((r) => (
            <div key={r.id} style={styles.tableRow}>
              <span style={styles.tableCellMain}>{r.village_name}, {r.district}</span>
              <span style={{ ...styles.statusTag, ...statusStyle(r.status) }}>{r.status}</span>
              <span style={styles.tableCellMuted}>
                {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{ ...styles.statCard, ...(accent ? styles.statCardAccent : {}) }}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  )
}

function statusStyle(status) {
  if (status === 'pending') return { color: '#C9601E', borderColor: 'rgba(201,96,30,0.4)' }
  if (status === 'approved') return { color: '#5C8369', borderColor: 'rgba(92,131,105,0.4)' }
  return { color: '#8A8270', borderColor: 'var(--border-strong)' }
}

const styles = {
  pageTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 30,
    fontWeight: 600,
    margin: '6px 0 0',
  },
  errorBanner: {
    background: 'rgba(201,96,30,0.1)',
    border: '1px solid rgba(201,96,30,0.3)',
    color: '#C9601E',
    padding: '10px 14px',
    borderRadius: 4,
    fontSize: 13,
    marginBottom: 20,
  },
  sectionLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--stone)',
    marginBottom: 12,
  },
  ledgerStrip: {
    display: 'flex',
    gap: 12,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  seal: {
    flexShrink: 0,
    width: 88,
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    padding: '12px 8px',
    textAlign: 'center',
    background: 'var(--surface)',
  },
  sealMonogram: {
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--terracotta)',
    marginBottom: 6,
  },
  sealName: {
    fontSize: 10.5,
    color: 'var(--stone)',
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 14,
  },
  statCard: {
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '18px 18px',
    background: 'var(--surface)',
  },
  statCardAccent: {
    borderColor: 'rgba(201,96,30,0.35)',
  },
  statValue: {
    fontFamily: 'var(--font-display)',
    fontSize: 32,
    fontWeight: 600,
  },
  statLabel: {
    fontSize: 12.5,
    color: 'var(--stone)',
    marginTop: 4,
  },
  table: {
    border: '1px solid var(--border)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    alignItems: 'center',
    gap: 16,
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    fontSize: 13.5,
  },
  tableCellMain: { color: 'var(--parchment)' },
  tableCellMuted: { color: 'var(--stone)', fontFamily: 'var(--font-mono)', fontSize: 12 },
  statusTag: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    border: '1px solid',
    borderRadius: 20,
    padding: '3px 10px',
    justifySelf: 'start',
  },
  muted: { color: 'var(--stone)', fontSize: 13 },
}
