import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { supabase } from '../lib/supabase'

const CATEGORY_COLORS = ['#3A5743', '#C9601E', '#8A8270', '#5C8369', '#9C6B3F', '#6B7A5E']

export default function Analytics() {
  const [trend, setTrend] = useState([])
  const [byVillage, setByVillage] = useState([])
  const [byCategory, setByCategory] = useState([])
  const [byStatus, setByStatus] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAnalytics()
  }, [])

  async function loadAnalytics() {
    setLoading(true)
    setError('')
    try {
      const { data: complaints, error: cErr } = await supabase
        .from('complaints')
        .select('id, status, category, village_id, created_at, villages(village_name)')
        .order('created_at', { ascending: true })
        .limit(5000)

      if (cErr) throw cErr

      setTrend(buildTrend(complaints || []))
      setByVillage(buildVillageBreakdown(complaints || []))
      setByCategory(buildCategoryBreakdown(complaints || []))
      setByStatus(buildStatusBreakdown(complaints || []))
    } catch (err) {
      setError(err.message || 'Failed to load analytics.')
    } finally {
      setLoading(false)
    }
  }

  function buildTrend(complaints) {
    const buckets = {}
    for (const c of complaints) {
      const d = new Date(c.created_at)
      const key = `${d.toLocaleString('en-IN', { month: 'short' })} ${d.getFullYear()}`
      buckets[key] = (buckets[key] || 0) + 1
    }
    return Object.entries(buckets).map(([month, count]) => ({ month, count }))
  }

  function buildVillageBreakdown(complaints) {
    const counts = {}
    for (const c of complaints) {
      const name = c.villages?.village_name || 'Unassigned'
      counts[name] = (counts[name] || 0) + 1
    }
    return Object.entries(counts)
      .map(([village, count]) => ({ village, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  function buildCategoryBreakdown(complaints) {
    const counts = {}
    for (const c of complaints) {
      const cat = c.category || 'Other'
      counts[cat] = (counts[cat] || 0) + 1
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }

  function buildStatusBreakdown(complaints) {
    const counts = {}
    for (const c of complaints) {
      counts[c.status] = (counts[c.status] || 0) + 1
    }
    return Object.entries(counts).map(([status, count]) => ({ status, count }))
  }

  return (
    <div>
      <header style={{ marginBottom: 28 }}>
        <p className="eyebrow">admin.gramseva.in &middot; analytics</p>
        <h1 style={styles.pageTitle}>Platform Analytics</h1>
      </header>

      {error && <div style={styles.errorBanner}>{error}</div>}
      {loading && <p style={styles.muted}>Loading analytics…</p>}

      {!loading && (
        <>
          <section style={styles.panel}>
            <p style={styles.sectionLabel}>Complaints over time</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,241,230,0.06)" />
                <XAxis dataKey="month" tick={{ fill: '#8A8270', fontSize: 11 }} axisLine={{ stroke: 'rgba(245,241,230,0.12)' }} />
                <YAxis tick={{ fill: '#8A8270', fontSize: 11 }} axisLine={{ stroke: 'rgba(245,241,230,0.12)' }} />
                <Tooltip contentStyle={{ background: '#1C2A1F', border: '1px solid rgba(245,241,230,0.16)', borderRadius: 4, fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke="#C9601E" strokeWidth={2} dot={{ r: 3, fill: '#C9601E' }} />
              </LineChart>
            </ResponsiveContainer>
          </section>

          <div style={styles.twoCol}>
            <section style={styles.panel}>
              <p style={styles.sectionLabel}>Top villages by complaint volume</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byVillage} layout="vertical" margin={{ left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,241,230,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#8A8270', fontSize: 11 }} axisLine={{ stroke: 'rgba(245,241,230,0.12)' }} />
                  <YAxis
                    type="category"
                    dataKey="village"
                    tick={{ fill: '#F5F1E6', fontSize: 11.5 }}
                    width={120}
                    axisLine={{ stroke: 'rgba(245,241,230,0.12)' }}
                  />
                  <Tooltip contentStyle={{ background: '#1C2A1F', border: '1px solid rgba(245,241,230,0.16)', borderRadius: 4, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#3A5743" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section style={styles.panel}>
              <p style={styles.sectionLabel}>By status</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byStatus}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,241,230,0.06)" />
                  <XAxis dataKey="status" tick={{ fill: '#8A8270', fontSize: 11 }} axisLine={{ stroke: 'rgba(245,241,230,0.12)' }} />
                  <YAxis tick={{ fill: '#8A8270', fontSize: 11 }} axisLine={{ stroke: 'rgba(245,241,230,0.12)' }} />
                  <Tooltip contentStyle={{ background: '#1C2A1F', border: '1px solid rgba(245,241,230,0.16)', borderRadius: 4, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#5C8369" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>

          <section style={styles.panel}>
            <p style={styles.sectionLabel}>By category</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <ResponsiveContainer width={280} height={240}>
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1C2A1F', border: '1px solid rgba(245,241,230,0.16)', borderRadius: 4, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={styles.legend}>
                {byCategory.map((c, i) => (
                  <div key={c.name} style={styles.legendRow}>
                    <span style={{ ...styles.legendDot, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                    <span style={styles.legendLabel}>{c.name}</span>
                    <span style={styles.legendValue}>{c.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

const styles = {
  pageTitle: { fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, margin: '6px 0 0' },
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
    marginBottom: 16,
  },
  panel: {
    border: '1px solid var(--border)',
    borderRadius: 4,
    background: 'var(--surface)',
    padding: '20px 22px',
    marginBottom: 18,
  },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 },
  legend: { display: 'flex', flexDirection: 'column', gap: 8 },
  legendRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 },
  legendDot: { width: 9, height: 9, borderRadius: '50%', display: 'inline-block' },
  legendLabel: { color: 'var(--parchment)', minWidth: 120 },
  legendValue: { color: 'var(--stone)', fontFamily: 'var(--font-mono)', fontSize: 12 },
  muted: { color: 'var(--stone)', fontSize: 13 },
}
