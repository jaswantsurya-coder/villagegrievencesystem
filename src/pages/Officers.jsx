import { useEffect, useState } from 'react'
import { supabaseAux } from '../lib/supabase'
import {
  ShieldCheck,
  Search,
  Building2,
  Phone,
  Mail,
  RefreshCw,
  Loader2,
  Award,
  UserCheck,
  Users,
  ChevronDown,
  ChevronUp,
  MapPin,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

export default function Officers() {
  const [villages, setVillages] = useState([])
  const [profiles, setProfiles] = useState([])
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedVillageId, setExpandedVillageId] = useState(null)

  useEffect(() => {
    loadPanchayatData()
  }, [])

  async function loadPanchayatData() {
    setLoading(true)
    try {
      const [villageRes, profileRes, complaintRes] = await Promise.all([
        supabaseAux.from('villages').select('*').order('village_name'),
        supabaseAux.from('profiles').select('*'),
        supabaseAux.from('complaints').select('id, village_id, assigned_officer_id, status'),
      ])

      const superAdminIds = new Set(
        (profileRes.data || [])
          .filter((p) => p.role === 'super_admin' || p.email === 'srijaswantsuryacherri@gmail.com')
          .map((p) => p.id)
      )

      const citizenVillages = (villageRes.data || []).filter(
        (v) => !superAdminIds.has(v.sarpanch_user_id) && v.village_name !== 'Visakhapatnam HQ'
      )

      setVillages(citizenVillages)
      if (profileRes.data) setProfiles(profileRes.data.filter((p) => !superAdminIds.has(p.id)))
      if (complaintRes.data) setComplaints(complaintRes.data)
    } catch (err) {
      console.error('Error loading panchayat personnel:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter staff by role
  const fieldOfficers = profiles.filter((p) => p.role === 'officer')
  const villageAdmins = profiles.filter((p) => p.role === 'village_admin' || p.role === 'sarpanch')

  // Group personnel & complaints by village
  const villageUnits = villages.map((v) => {
    const admin = villageAdmins.find((p) => p.village_id === v.id || p.id === v.sarpanch_user_id)
    const officers = fieldOfficers.filter((p) => p.village_id === v.id)
    const vComplaints = complaints.filter((c) => c.village_id === v.id)
    const openCount = vComplaints.filter((c) => c.status === 'Open' || c.status === 'Pending').length
    const resolvedCount = vComplaints.filter((c) => c.status === 'Resolved' || c.status === 'Closed').length

    return {
      village: v,
      admin,
      officers,
      totalComplaints: vComplaints.length,
      openCount,
      resolvedCount,
    }
  })

  // Unassigned field officers pool
  const unassignedOfficers = fieldOfficers.filter((p) => !p.village_id)

  // Search filtering across villages, admins, officers
  const filteredUnits = villageUnits.filter((u) => {
    const q = search.toLowerCase()
    const vName = u.village.village_name || ''
    const dist = u.village.district || ''
    const adminName = u.admin?.name || u.admin?.full_name || ''
    const matchesOfficers = u.officers.some(
      (o) => (o.name || '').toLowerCase().includes(q) || (o.phone || '').includes(q)
    )

    return (
      vName.toLowerCase().includes(q) ||
      dist.toLowerCase().includes(q) ||
      adminName.toLowerCase().includes(q) ||
      matchesOfficers
    )
  })

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Panchayat Administration & Officers Directory</h1>
          <p style={styles.pageSubtitle}>
            Organized by Gram Panchayat administrative units · Real-time live sync
            <span style={styles.dbTag}>LIVE · dtucrczgagpzjbbrwqit</span>
          </p>
        </div>
        <button onClick={loadPanchayatData} style={styles.refreshBtn} className="btn-interactive">
          <RefreshCw style={{ width: 14, height: 14 }} /> Refresh Directory
        </button>
      </div>

      {/* Summary KPI Banner */}
      <div style={styles.kpiRow}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiIconBox}>
            <Building2 style={{ width: 18, height: 18, color: '#2563EB' }} />
          </div>
          <div>
            <div style={styles.kpiVal}>{villages.length}</div>
            <div style={styles.kpiLabel}>Panchayat Units</div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIconBox, background: '#FEF3C7', color: '#D97706' }}>
            <Award style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <div style={styles.kpiVal}>{villageAdmins.length}</div>
            <div style={styles.kpiLabel}>Village Admins / Sarpanchs</div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIconBox, background: '#F3E8FF', color: '#8B5CF6' }}>
            <ShieldCheck style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <div style={styles.kpiVal}>{fieldOfficers.length}</div>
            <div style={styles.kpiLabel}>Field Inspectors / Staff</div>
          </div>
        </div>
      </div>

      {/* Control & Search Bar */}
      <div style={styles.controlBar}>
        <div style={styles.searchBox}>
          <Search style={{ width: 15, height: 15, color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search village name, district, admin, or officer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={styles.countBadge}>
          Showing {filteredUnits.length} of {villageUnits.length} Gram Panchayats
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={styles.loadingBox}>
          <Loader2 style={{ width: 20, height: 20, color: '#2563EB', animation: 'spin 1s linear infinite' }} />
          <span>Loading Panchayat units and officer directories...</span>
        </div>
      ) : filteredUnits.length === 0 ? (
        <div style={styles.emptyBox}>No Gram Panchayat units found matching your search.</div>
      ) : (
        <div style={styles.unitsList}>
          {filteredUnits.map((u) => {
            const isExpanded = expandedVillageId === u.village.id
            return (
              <div key={u.village.id} style={styles.unitCard}>
                {/* Unit Header */}
                <div style={styles.unitHeader}>
                  <div style={styles.unitTitleBox}>
                    <div style={styles.villageAvatar}>
                      <Building2 style={{ width: 20, height: 20, color: '#2563EB' }} />
                    </div>
                    <div>
                      <div style={styles.villageName}>
                        {u.village.village_name || 'Gram Panchayat'}
                        <span style={styles.codeBadge}>JOIN: {u.village.join_code}</span>
                      </div>
                      <div style={styles.locationMeta}>
                        <MapPin style={{ width: 12, height: 12, color: '#64748B' }} />
                        {u.village.district}, {u.village.state || 'Andhra Pradesh'}
                      </div>
                    </div>
                  </div>

                  {/* Summary Pills */}
                  <div style={styles.pillGroup}>
                    <div style={styles.unitPill}>
                      <Award style={{ width: 13, height: 13, color: u.admin ? '#16A34A' : '#D97706' }} />
                      <span>{u.admin ? '1 Sarpanch' : 'No Admin'}</span>
                    </div>

                    <div style={styles.unitPill}>
                      <ShieldCheck style={{ width: 13, height: 13, color: '#8B5CF6' }} />
                      <span>{u.officers.length} Officers</span>
                    </div>

                    <div style={styles.unitPill}>
                      <ClipboardList style={{ width: 13, height: 13, color: '#2563EB' }} />
                      <span>{u.totalComplaints} Tickets</span>
                    </div>

                    <button
                      onClick={() => setExpandedVillageId(isExpanded ? null : u.village.id)}
                      style={styles.expandBtn}
                      className="btn-interactive"
                    >
                      {isExpanded ? (
                        <>Hide Personnel Details <ChevronUp style={{ width: 14, height: 14 }} /></>
                      ) : (
                        <>View Officers & Admin <ChevronDown style={{ width: 14, height: 14 }} /></>
                      )}
                    </button>
                  </div>
                </div>

                {/* Village Admin Banner */}
                <div style={styles.adminBanner}>
                  <div style={styles.adminHeader}>
                    <Award style={{ width: 15, height: 15, color: '#D97706' }} />
                    <span style={styles.adminSectionTitle}>Village Administrator / Sarpanch:</span>
                  </div>
                  {u.admin ? (
                    <div style={styles.adminDetails}>
                      <strong style={styles.adminName}>{u.admin.name || u.admin.full_name || 'Panchayat Admin'}</strong>
                      {u.admin.email && <span style={styles.metaItem}><Mail style={{ width: 11, height: 11 }} /> {u.admin.email}</span>}
                      {u.admin.phone && <span style={styles.metaItem}><Phone style={{ width: 11, height: 11 }} /> {u.admin.phone}</span>}
                      <span style={styles.verifiedBadge}>Verified Sarpanch</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>
                      No Sarpanch currently assigned to this Panchayat.
                    </span>
                  )}
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div style={styles.expandedContent}>
                    <h4 style={styles.sectionHeader}>
                      <ShieldCheck style={{ width: 16, height: 16, color: '#8B5CF6' }} />
                      Assigned Field Officers & Staff ({u.officers.length})
                    </h4>

                    {u.officers.length === 0 ? (
                      <div style={styles.noOfficersBox}>
                        No field officers assigned to {u.village.village_name} yet.
                      </div>
                    ) : (
                      <div style={styles.officerGrid}>
                        {u.officers.map((o) => (
                          <div key={o.id} style={styles.officerCard}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={styles.officerAvatar}>
                                {(o.name || 'Off')[0]}
                              </div>
                              <div>
                                <div style={styles.officerNameText}>{o.name || 'Field Inspector'}</div>
                                <div style={styles.officerRoleText}>Panchayat Field Staff</div>
                              </div>
                            </div>
                            <div style={styles.officerContact}>
                              {o.phone && <div><Phone style={{ width: 11, height: 11 }} /> {o.phone}</div>}
                              {o.email && <div><Mail style={{ width: 11, height: 11 }} /> {o.email}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
    cursor: 'pointer',
  },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  kpiCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 16,
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
  },
  kpiIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  kpiVal: { fontSize: 20, fontWeight: 800, color: '#0F172A', lineHeight: 1 },
  kpiLabel: { fontSize: 12, color: '#64748B', marginTop: 4 },
  controlBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 12,
    padding: '0 14px',
    height: 42,
    width: 420,
  },
  searchInput: { border: 'none', outline: 'none', fontSize: 13, width: '100%' },
  countBadge: { fontSize: 12, fontWeight: 600, color: '#64748B' },
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
  unitsList: { display: 'flex', flexDirection: 'column', gap: 16 },
  unitCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 18,
    padding: 20,
    boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  unitHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  unitTitleBox: { display: 'flex', alignItems: 'center', gap: 14 },
  villageAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  villageName: { fontSize: 17, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 },
  codeBadge: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 700,
    color: '#2563EB',
    background: '#EFF6FF',
    padding: '2px 6px',
    borderRadius: 4,
  },
  locationMeta: { fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 },
  pillGroup: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  unitPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 10,
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    fontSize: 12,
    fontWeight: 700,
    color: '#334155',
  },
  expandBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    borderRadius: 10,
    background: '#2563EB',
    color: '#FFFFFF',
    border: 'none',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  adminBanner: {
    background: '#FFFBEB',
    border: '1px solid #FDE68A',
    borderRadius: 12,
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  adminHeader: { display: 'flex', alignItems: 'center', gap: 6 },
  adminSectionTitle: { fontSize: 12, fontWeight: 700, color: '#92400E' },
  adminDetails: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  adminName: { fontSize: 13, color: '#78350F', fontWeight: 800 },
  metaItem: { fontSize: 11.5, color: '#92400E', display: 'flex', alignItems: 'center', gap: 4 },
  verifiedBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: '#15803D',
    background: '#DCFCE7',
    padding: '2px 8px',
    borderRadius: 6,
  },
  expandedContent: {
    marginTop: 8,
    paddingTop: 16,
    borderTop: '1px dashed #CBD5E1',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  sectionHeader: { fontSize: 13, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6, margin: 0 },
  noOfficersBox: {
    padding: 16,
    fontSize: 12,
    color: '#94A3B8',
    background: '#F8FAFC',
    borderRadius: 10,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  officerGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  officerCard: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 12,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  officerAvatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#F3E8FF',
    color: '#7C3AED',
    fontSize: 13,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justify: 'center',
    textTransform: 'uppercase',
  },
  officerNameText: { fontSize: 12.5, fontWeight: 700, color: '#0F172A' },
  officerRoleText: { fontSize: 10.5, color: '#64748B' },
  officerContact: { fontSize: 11, color: '#475569', display: 'flex', flexDirection: 'column', gap: 3 },
}
