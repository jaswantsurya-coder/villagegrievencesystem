import { useEffect, useState } from 'react'
import { supabaseAux } from '../lib/supabase'
import { Users, Search, UserCheck, Shield, MapPin, Phone, RefreshCw, Loader2 } from 'lucide-react'

export default function Citizens() {
  const [profiles, setProfiles] = useState([])
  const [villages, setVillages] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Fetch all villages first for lookup
      const { data: villageData } = await supabaseAux
        .from('villages')
        .select('id, village_name, district, state')

      const villageMap = {}
      if (villageData) {
        villageData.forEach((v) => {
          villageMap[v.id] = v
        })
      }
      setVillages(villageMap)

      // Fetch all profiles
      const { data: profileData, error } = await supabaseAux
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && profileData && profileData.length > 0) {
        setProfiles(profileData)
      }
    } catch (err) {
      console.error('Error loading citizen data:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = profiles
    .filter((p) => roleFilter === 'all' || p.role === roleFilter)
    .filter(
      (p) =>
        (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.phone || '').includes(search) ||
        (villages[p.village_id]?.village_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (villages[p.village_id]?.district || '').toLowerCase().includes(search.toLowerCase())
    )

  const totalCitizens = profiles.filter((p) => p.role === 'citizen').length
  const totalOfficers = profiles.filter((p) => p.role === 'officer').length
  const totalAdmins = profiles.filter((p) => p.role === 'super_admin').length

  const roleTabs = [
    { key: 'all', label: 'All Users', count: profiles.length },
    { key: 'citizen', label: 'Citizens', count: totalCitizens },
    { key: 'officer', label: 'Officers', count: totalOfficers },
    { key: 'super_admin', label: 'Admins', count: totalAdmins },
  ]

  function formatDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  function getRoleBadge(role) {
    const map = {
      citizen: { bg: '#DBEAFE', color: '#1D4ED8', label: 'Citizen' },
      officer: { bg: '#F3E8FF', color: '#7C3AED', label: 'Officer' },
      super_admin: { bg: '#FEE2E2', color: '#B91C1C', label: 'Super Admin' },
    }
    const r = map[role] || { bg: '#F1F5F9', color: '#64748B', label: role || 'Unknown' }
    return (
      <span style={{ ...styles.roleBadge, background: r.bg, color: r.color }}>{r.label}</span>
    )
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Citizen Network</h1>
          <p style={styles.pageSubtitle}>
            {profiles.length} registered users across {Object.keys(villages).length} connected Panchayats
            <span style={styles.dbTag}>LIVE · dtucrczgagpzjbbrwqit</span>
          </p>
        </div>
        <button onClick={loadData} style={styles.refreshBtn} className="btn-interactive">
          <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}>
          <Users style={{ width: 18, height: 18, color: '#2563EB' }} />
          <div>
            <div style={styles.summaryVal}>{profiles.length}</div>
            <div style={styles.summaryLabel}>Total Profiles</div>
          </div>
        </div>
        <div style={styles.summaryCard}>
          <UserCheck style={{ width: 18, height: 18, color: '#16A34A' }} />
          <div>
            <div style={styles.summaryVal}>{totalCitizens}</div>
            <div style={styles.summaryLabel}>Citizens</div>
          </div>
        </div>
        <div style={styles.summaryCard}>
          <Shield style={{ width: 18, height: 18, color: '#7C3AED' }} />
          <div>
            <div style={styles.summaryVal}>{totalOfficers}</div>
            <div style={styles.summaryLabel}>Officers</div>
          </div>
        </div>
        <div style={styles.summaryCard}>
          <MapPin style={{ width: 18, height: 18, color: '#D97706' }} />
          <div>
            <div style={styles.summaryVal}>{Object.keys(villages).length}</div>
            <div style={styles.summaryLabel}>Villages</div>
          </div>
        </div>
      </div>

      {/* Role Filter Tabs */}
      <div style={styles.tabRow}>
        {roleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setRoleFilter(tab.key)}
            style={{
              ...styles.tab,
              ...(roleFilter === tab.key ? styles.tabActive : {}),
            }}
            className="btn-interactive"
          >
            {tab.label}
            <span style={styles.tabCount}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Search + Count */}
      <div style={styles.controlBar}>
        <div style={styles.searchBox}>
          <Search style={{ width: 15, height: 15, color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search name, phone, village, district..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={styles.countBadge}>Showing {filtered.length} of {profiles.length}</div>
      </div>

      {/* Table */}
      <div style={styles.card}>
        {loading ? (
          <div style={styles.loadingBox}>
            <Loader2 style={{ width: 20, height: 20, color: '#2563EB', animation: 'spin 1s linear infinite' }} />
            <span>Loading from Supabase...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyBox}>No users found matching your criteria.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Village</th>
                <th style={styles.th}>District</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Language</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Registered</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const v = villages[p.village_id] || {}
                return (
                  <tr key={p.id} style={styles.tr}>
                    <td style={styles.tdBold}>{p.name || '—'}</td>
                    <td style={styles.tdMono}>{p.phone || '—'}</td>
                    <td style={styles.td}>{v.village_name || '—'}</td>
                    <td style={styles.tdMuted}>{v.district || '—'}</td>
                    <td style={styles.td}>{getRoleBadge(p.role)}</td>
                    <td style={styles.tdMuted}>{p.lang_pref === 'te' ? 'Telugu' : p.lang_pref === 'hi' ? 'Hindi' : 'English'}</td>
                    <td style={{ ...styles.tdMono, textAlign: 'right' }}>{formatDate(p.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
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
  tabRow: {
    display: 'flex',
    gap: 6,
    borderBottom: '1px solid #E2E8F0',
    paddingBottom: 2,
  },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: '10px 10px 0 0',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#64748B',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
  },
  tabActive: {
    color: '#2563EB',
    borderBottom: '2px solid #2563EB',
    background: '#EFF6FF',
    fontWeight: 700,
  },
  tabCount: {
    fontSize: 10.5,
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    background: '#F1F5F9',
    color: '#475569',
    padding: '1px 6px',
    borderRadius: 6,
  },
  controlBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  searchBox: { display: 'flex', alignItems: 'center', gap: 10, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '0 14px', height: 42, width: 380 },
  searchInput: { border: 'none', outline: 'none', fontSize: 13, width: '100%' },
  countBadge: { fontSize: 12, fontWeight: 600, color: '#64748B' },
  card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' },
  tr: { borderBottom: '1px solid #F1F5F9' },
  td: { padding: '12px 14px', color: '#0F172A' },
  tdBold: { padding: '12px 14px', fontWeight: 700, color: '#0F172A' },
  tdMuted: { padding: '12px 14px', color: '#64748B' },
  tdMono: { padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: '#64748B' },
  roleBadge: { fontSize: 10.5, fontWeight: 700, borderRadius: 99, padding: '3px 10px', display: 'inline-block' },
  loadingBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40, fontSize: 13, color: '#64748B' },
  emptyBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, fontSize: 13, color: '#94A3B8' },
}
