import { useEffect, useState } from 'react'
import { supabaseAux } from '../lib/supabase'
import { Building2, Search, Users, AlertCircle, Key, Award, Plus, RefreshCw, Loader2, MapPin } from 'lucide-react'

export default function Villages() {
  const [villages, setVillages] = useState([])
  const [complaints, setComplaints] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadVillages()
  }, [])

  async function loadVillages() {
    setLoading(true)
    try {
      const [villageRes, complaintRes, profileRes] = await Promise.all([
        supabaseAux.from('villages').select('*').order('village_name'),
        supabaseAux.from('complaints').select('id, village_id, status, is_escalated'),
        supabaseAux.from('profiles').select('id, email, village_id, role'),
      ])

      const superAdminIds = new Set(
        (profileRes.data || [])
          .filter((p) => p.role === 'super_admin' || p.email === 'srijaswantsuryacherri@gmail.com')
          .map((p) => p.id)
      )

      const citizenVillages = (villageRes.data || []).filter((v) => {
        if (superAdminIds.has(v.sarpanch_user_id)) return false
        const name = (v.village_name || '').toLowerCase().trim()
        return name !== 'visakhapatnam' && !name.startsWith('visakhapatnam')
      })

      setVillages(citizenVillages)
      if (complaintRes.data) setComplaints(complaintRes.data)
      if (profileRes.data) setProfiles(profileRes.data)
    } catch (err) {
      console.error('Error loading village data:', err)
    } finally {
      setLoading(false)
    }
  }

  function getVillageStats(villageId) {
    const citizenCount = profiles.filter((p) => p.village_id === villageId).length
    const villageComplaints = complaints.filter((c) => c.village_id === villageId)
    const totalComplaints = villageComplaints.length
    const resolved = villageComplaints.filter((c) => c.status === 'Resolved').length
    const escalated = villageComplaints.filter((c) => c.is_escalated).length

    // Score: higher citizens + lower escalations = better
    const score = Math.min(100, Math.max(60, 100 - escalated * 5 + Math.floor(citizenCount / 2)))

    let health = 'Optimal'
    if (score < 70) health = 'Needs Attention'
    else if (score < 85) health = 'Moderate'
    else if (score < 92) health = 'Good'

    return { citizenCount, totalComplaints, resolved, escalated, score, health }
  }

  function getHealthStyle(health) {
    const map = {
      'Optimal': { bg: '#DCFCE7', color: '#15803D' },
      'Good': { bg: '#DBEAFE', color: '#1D4ED8' },
      'Moderate': { bg: '#FEF3C7', color: '#B45309' },
      'Needs Attention': { bg: '#FEE2E2', color: '#B91C1C' },
    }
    return map[health] || map['Good']
  }

  function formatDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const filtered = villages.filter(
    (v) =>
      v.village_name?.toLowerCase().includes(search.toLowerCase()) ||
      v.district?.toLowerCase().includes(search.toLowerCase()) ||
      v.join_code?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Village Registry</h1>
          <p style={styles.pageSubtitle}>
            {villages.length} Connected Panchayats · Join Code Access Ledger
            <span style={styles.dbTag}>LIVE · dtucrczgagpzjbbrwqit</span>
          </p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={loadVillages} style={styles.refreshBtn} className="btn-interactive">
            <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
          </button>
          <button style={styles.createBtn} className="btn-interactive">
            <Plus style={{ width: 16, height: 16 }} /> Create Village
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}>
          <Building2 style={{ width: 18, height: 18, color: '#2563EB' }} />
          <div>
            <div style={styles.summaryVal}>{villages.length}</div>
            <div style={styles.summaryLabel}>Total Villages</div>
          </div>
        </div>
        <div style={styles.summaryCard}>
          <Users style={{ width: 18, height: 18, color: '#16A34A' }} />
          <div>
            <div style={styles.summaryVal}>{profiles.length}</div>
            <div style={styles.summaryLabel}>Total Citizens</div>
          </div>
        </div>
        <div style={styles.summaryCard}>
          <AlertCircle style={{ width: 18, height: 18, color: '#D97706' }} />
          <div>
            <div style={styles.summaryVal}>{complaints.length}</div>
            <div style={styles.summaryLabel}>Total Complaints</div>
          </div>
        </div>
        <div style={styles.summaryCard}>
          <Award style={{ width: 18, height: 18, color: '#7C3AED' }} />
          <div>
            <div style={styles.summaryVal}>
              {villages.length > 0
                ? Math.round(
                    villages.reduce((acc, v) => acc + getVillageStats(v.id).score, 0) / villages.length
                  )
                : 0}
              /100
            </div>
            <div style={styles.summaryLabel}>Avg Health Score</div>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div style={styles.controlBar}>
        <div style={styles.searchBox}>
          <Search style={{ width: 15, height: 15, color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search village name, district, join code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={styles.totalCount}>Showing {filtered.length} of {villages.length} Villages</div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={styles.loadingBox}>
          <Loader2 style={{ width: 20, height: 20, color: '#2563EB', animation: 'spin 1s linear infinite' }} />
          <span>Loading villages from Supabase...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={styles.emptyBox}>No villages found matching your search.</div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((v) => {
            const stats = getVillageStats(v.id)
            const hStyle = getHealthStyle(stats.health)
            return (
              <div key={v.id} style={styles.card} className="stat-card-interactive">
                <div style={styles.cardHeader}>
                  <div style={styles.iconBox}>
                    <Building2 style={{ width: 18, height: 18, color: '#2563EB' }} />
                  </div>
                  <div style={styles.titleBox}>
                    <h3 style={styles.villageName}>{v.village_name}</h3>
                    <span style={styles.locationText}>
                      <MapPin style={{ width: 10, height: 10 }} /> {v.district}, {v.state || 'AP'}
                    </span>
                  </div>
                  <span style={{ ...styles.healthBadge, background: hStyle.bg, color: hStyle.color }}>
                    {stats.health}
                  </span>
                </div>

                <div style={styles.codeRow}>
                  <Key style={{ width: 13, height: 13, color: '#64748B' }} />
                  <span style={styles.codeLabel}>JOIN CODE:</span>
                  <span style={styles.codeVal}>{v.join_code}</span>
                </div>

                <div style={styles.sarpanchBox}>
                  <span style={{ fontSize: 11, color: '#64748B' }}>Sarpanch ID:</span>
                  <strong style={{ fontSize: 11, color: '#0F172A', fontFamily: 'var(--font-mono)' }}>
                    {v.sarpanch_user_id ? v.sarpanch_user_id.slice(0, 8) + '...' : 'Not Assigned'}
                  </strong>
                </div>

                <div style={styles.metaRow}>
                  <span style={{ fontSize: 10.5, color: '#94A3B8' }}>
                    Created: {formatDate(v.created_at)}
                  </span>
                </div>

                <div style={styles.statsRow}>
                  <div style={styles.statItem}>
                    <Users style={{ width: 14, height: 14, color: '#2563EB' }} />
                    <div>
                      <div style={styles.statVal}>{stats.citizenCount}</div>
                      <div style={styles.statLabel}>Citizens</div>
                    </div>
                  </div>

                  <div style={styles.statItem}>
                    <AlertCircle style={{ width: 14, height: 14, color: '#D97706' }} />
                    <div>
                      <div style={styles.statVal}>{stats.totalComplaints}</div>
                      <div style={styles.statLabel}>Complaints</div>
                    </div>
                  </div>

                  <div style={styles.statItem}>
                    <Award style={{ width: 14, height: 14, color: '#166534' }} />
                    <div>
                      <div style={styles.statVal}>{stats.score}/100</div>
                      <div style={styles.statLabel}>Score</div>
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
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0F172A',
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
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
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
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
  createBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 18px',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 700,
    color: '#FFFFFF',
    background: '#2563EB',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
  },
  summaryRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 14,
  },
  summaryCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 14,
    padding: '14px 18px',
    boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
  },
  summaryVal: { fontSize: 20, fontWeight: 800, color: '#0F172A', lineHeight: 1 },
  summaryLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },
  controlBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 12,
    padding: '0 14px',
    height: 42,
    width: 380,
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    fontSize: 13,
    width: '100%',
  },
  totalCount: {
    fontSize: 12,
    fontWeight: 600,
    color: '#64748B',
  },
  loadingBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 60,
    fontSize: 13,
    color: '#64748B',
    background: '#FFFFFF',
    borderRadius: 18,
    border: '1px solid #E2E8F0',
  },
  emptyBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
    fontSize: 13,
    color: '#94A3B8',
    background: '#FFFFFF',
    borderRadius: 18,
    border: '1px solid #E2E8F0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 18,
    padding: '18px 20px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 12,
    cursor: 'pointer',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleBox: {
    flex: 1,
  },
  villageName: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0F172A',
    lineHeight: 1.1,
  },
  locationText: {
    fontSize: 11.5,
    color: '#64748B',
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  },
  healthBadge: {
    fontSize: 10.5,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 6,
  },
  codeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#F8FAFC',
    border: '1px solid #F1F5F9',
    padding: '6px 10px',
    borderRadius: 8,
    fontSize: 11.5,
  },
  codeLabel: {
    color: '#64748B',
    fontWeight: 600,
    fontSize: 10.5,
  },
  codeVal: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    color: '#2563EB',
  },
  sarpanchBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 0',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
    paddingTop: 10,
    borderTop: '1px solid #F1F5F9',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  statVal: {
    fontSize: 12.5,
    fontWeight: 800,
    color: '#0F172A',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 9.5,
    color: '#64748B',
    marginTop: 2,
  },
}
