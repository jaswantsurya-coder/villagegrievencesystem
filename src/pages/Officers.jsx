import { useEffect, useState } from 'react'
import { supabaseAux } from '../lib/supabase'
import { ShieldCheck, Search, Building2, Phone, Mail, RefreshCw, Loader2, Award, UserCheck } from 'lucide-react'

export default function Officers() {
  const [officers, setOfficers] = useState([])
  const [villages, setVillages] = useState({})
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadOfficersData()
  }, [])

  async function loadOfficersData() {
    setLoading(true)
    try {
      const [officerRes, villageRes, complaintRes] = await Promise.all([
        supabaseAux.from('profiles').select('*').eq('role', 'officer').order('created_at', { ascending: false }),
        supabaseAux.from('villages').select('id, village_name, district'),
        supabaseAux.from('complaints').select('id, assigned_officer_id, status'),
      ])

      const vMap = {}
      if (villageRes.data) {
        villageRes.data.forEach((v) => { vMap[v.id] = v })
      }
      setVillages(vMap)

      if (complaintRes.data) {
        setComplaints(complaintRes.data)
      }

      if (officerRes.data) {
        setOfficers(officerRes.data)
      }
    } catch (err) {
      console.error('Error loading officers:', err)
    } finally {
      setLoading(false)
    }
  }

  function getOfficerStats(officerId) {
    const assignedComplaints = complaints.filter((c) => c.assigned_officer_id === officerId)
    const resolved = assignedComplaints.filter((c) => c.status === 'Resolved').length
    return { totalAssigned: assignedComplaints.length, resolved }
  }

  function formatDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const filtered = officers.filter((o) => {
    const vName = villages[o.village_id]?.village_name || ''
    const dist = villages[o.village_id]?.district || ''
    const q = search.toLowerCase()
    return (
      (o.name || '').toLowerCase().includes(q) ||
      (o.phone || '').includes(q) ||
      vName.toLowerCase().includes(q) ||
      dist.toLowerCase().includes(q)
    )
  })

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Village Officers Directory</h1>
          <p style={styles.pageSubtitle}>
            {officers.length} Field Officers & Panchayat Leads
            <span style={styles.dbTag}>LIVE · dtucrczgagpzjbbrwqit</span>
          </p>
        </div>
        <button onClick={loadOfficersData} style={styles.refreshBtn} className="btn-interactive">
          <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
        </button>
      </div>

      {/* Control Bar */}
      <div style={styles.controlBar}>
        <div style={styles.searchBox}>
          <Search style={{ width: 15, height: 15, color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search officer name, phone, village..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={styles.countBadge}>Showing {filtered.length} of {officers.length} Officers</div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={styles.loadingBox}>
          <Loader2 style={{ width: 20, height: 20, color: '#2563EB', animation: 'spin 1s linear infinite' }} />
          <span>Loading officers from Supabase...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={styles.emptyBox}>No officers found in the database.</div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((o) => {
            const villageObj = villages[o.village_id] || {}
            const stats = getOfficerStats(o.id)
            return (
              <div key={o.id} style={styles.card} className="stat-card-interactive">
                <div style={styles.cardHeader}>
                  <div style={styles.avatarBox}>
                    <ShieldCheck style={{ width: 20, height: 20, color: '#7C3AED' }} />
                  </div>
                  <div style={styles.titleBox}>
                    <h3 style={styles.officerName}>{o.name || 'Unnamed Officer'}</h3>
                    <span style={styles.deptText}>Field Inspection & Governance</span>
                  </div>
                  <span style={styles.statusBadge}>Active</span>
                </div>

                <div style={styles.infoRow}>
                  <Building2 style={{ width: 13, height: 13, color: '#64748B' }} />
                  <span style={styles.infoText}>
                    {villageObj.village_name ? `${villageObj.village_name}, ${villageObj.district}` : 'Unassigned Village'}
                  </span>
                </div>

                <div style={styles.infoRow}>
                  <Phone style={{ width: 13, height: 13, color: '#64748B' }} />
                  <span style={styles.infoMono}>{o.phone || 'No phone registered'}</span>
                </div>

                <div style={styles.statsFooter}>
                  <div style={styles.statItem}>
                    <UserCheck style={{ width: 14, height: 14, color: '#2563EB' }} />
                    <div>
                      <div style={styles.statVal}>{stats.totalAssigned}</div>
                      <div style={styles.statLabel}>Assigned</div>
                    </div>
                  </div>

                  <div style={styles.statItem}>
                    <Award style={{ width: 14, height: 14, color: '#16A34A' }} />
                    <div>
                      <div style={styles.statVal}>{stats.resolved}</div>
                      <div style={styles.statLabel}>Resolved</div>
                    </div>
                  </div>

                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>Joined</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      {formatDate(o.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: 20 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { fontSize: 22, fontWeight: 800, color: '#0F172A' },
  pageSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 },
  dbTag: {
    display: 'inline-block',
    fontSize: 9.5,
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    color: '#16A34A',
    background: '#DCFCE7',
    padding: '2px 8px',
    borderRadius: 6,
    letterSpacing: '0.04em',
  },
  refreshBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 10,
    fontSize: 12.5,
    fontWeight: 700,
    color: '#2563EB',
    background: '#EFF6FF',
    border: '1px solid #DBEAFE',
  },
  controlBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  searchBox: { display: 'flex', alignItems: 'center', gap: 10, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '0 14px', height: 42, width: 380 },
  searchInput: { border: 'none', outline: 'none', fontSize: 13, width: '100%' },
  countBadge: { fontSize: 12, fontWeight: 600, color: '#64748B' },
  loadingBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 60, fontSize: 13, color: '#64748B', background: '#FFFFFF', borderRadius: 18, border: '1px solid #E2E8F0' },
  emptyBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, fontSize: 13, color: '#94A3B8', background: '#FFFFFF', borderRadius: 18, border: '1px solid #E2E8F0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 18, padding: '18px 20px', boxShadow: '0 1px 3px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column', gap: 12 },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10 },
  avatarBox: { width: 36, height: 36, borderRadius: 10, background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleBox: { flex: 1 },
  officerName: { fontSize: 15, fontWeight: 800, color: '#0F172A', lineHeight: 1.1 },
  deptText: { fontSize: 11, color: '#64748B' },
  statusBadge: { fontSize: 10.5, fontWeight: 700, color: '#15803D', background: '#DCFCE7', padding: '3px 8px', borderRadius: 6 },
  infoRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155' },
  infoText: { fontSize: 12, color: '#334155' },
  infoMono: { fontFamily: 'var(--font-mono)', fontSize: 11.5, color: '#64748B' },
  statsFooter: { display: 'flex', alignItems: 'center', gap: 16, paddingTop: 10, borderTop: '1px solid #F1F5F9', marginTop: 4 },
  statItem: { display: 'flex', alignItems: 'center', gap: 6 },
  statVal: { fontSize: 12.5, fontWeight: 800, color: '#0F172A', lineHeight: 1 },
  statLabel: { fontSize: 9.5, color: '#64748B', marginTop: 2 },
}
