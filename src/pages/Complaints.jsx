import { useEffect, useState } from 'react'
import { supabaseAux } from '../lib/supabase'
import ComplaintDetailModal from '../components/ComplaintDetailModal'
import { AlertCircle, Search, Eye, Trash2, Filter, RefreshCw, Loader2, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

export default function Complaints() {
  const [complaints, setComplaints] = useState([])
  const [villages, setVillages] = useState({})
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedComplaint, setSelectedComplaint] = useState(null)
  const [deleting, setDeleting] = useState(null)

  async function deleteComplaint(complaint) {
    const confirmMsg = `Are you sure you want to permanently delete this complaint?\n\nTicket: ${complaint.ticket_number || complaint.id}\nTitle: ${complaint.title || 'General Grievance'}\n\nThis action cannot be undone.`
    if (!window.confirm(confirmMsg)) return

    setDeleting(complaint.id)
    try {
      const { error } = await supabaseAux
        .from('complaints')
        .delete()
        .eq('id', complaint.id)

      if (error) {
        alert('Failed to delete complaint: ' + error.message)
      } else {
        setComplaints(prev => prev.filter(c => c.id !== complaint.id))
        if (selectedComplaint?.id === complaint.id) {
          setSelectedComplaint(null)
        }
      }
    } catch (err) {
      console.error('Delete error:', err)
      alert('Failed to delete complaint.')
    } finally {
      setDeleting(null)
    }
  }

  useEffect(() => {
    loadComplaintsData()
  }, [])

  async function loadComplaintsData() {
    setLoading(true)
    try {
      // Fetch villages and profiles for reference
      const [villageRes, profileRes, complaintRes] = await Promise.all([
        supabaseAux.from('villages').select('id, village_name, district'),
        supabaseAux.from('profiles').select('id, name, phone, role'),
        supabaseAux.from('complaints').select('*').order('created_at', { ascending: false }),
      ])

      const vMap = {}
      if (villageRes.data) {
        villageRes.data.forEach((v) => { vMap[v.id] = v })
      }
      setVillages(vMap)

      const pMap = {}
      if (profileRes.data) {
        profileRes.data.forEach((p) => { pMap[p.id] = p })
      }
      setProfiles(pMap)

      if (complaintRes.data) {
        setComplaints(complaintRes.data)
      }
    } catch (err) {
      console.error('Error loading complaints:', err)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const filtered = complaints.filter((c) => {
    const statusMatch =
      statusFilter === 'All'
        ? true
        : statusFilter === 'Escalated'
        ? c.is_escalated
        : c.status?.toLowerCase() === statusFilter.toLowerCase()

    const vName = villages[c.village_id]?.village_name || ''
    const cName = profiles[c.citizen_id]?.name || ''
    const q = search.toLowerCase()

    const searchMatch =
      (c.id || '').toLowerCase().includes(q) ||
      (c.title || '').toLowerCase().includes(q) ||
      (c.category || '').toLowerCase().includes(q) ||
      vName.toLowerCase().includes(q) ||
      cName.toLowerCase().includes(q)

    return statusMatch && searchMatch
  })

  const totalCount = complaints.length
  const openCount = complaints.filter((c) => c.status === 'Open' || c.status === 'Submitted' || c.status === 'Pending').length
  const inProgressCount = complaints.filter((c) => c.status === 'In Progress').length
  const resolvedCount = complaints.filter((c) => c.status === 'Resolved').length
  const escalatedCount = complaints.filter((c) => c.is_escalated).length

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Complaint Center</h1>
          <p style={styles.pageSubtitle}>
            Centralized Citizen Telemetry & Resolution Tracker
            <span style={styles.dbTag}>LIVE · dtucrczgagpzjbbrwqit</span>
          </p>
        </div>
        <button onClick={loadComplaintsData} style={styles.refreshBtn} className="btn-interactive">
          <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
        </button>
      </div>

      {/* Summary Row */}
      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}>
          <AlertCircle style={{ width: 18, height: 18, color: '#2563EB' }} />
          <div>
            <div style={styles.summaryVal}>{totalCount}</div>
            <div style={styles.summaryLabel}>Total Complaints</div>
          </div>
        </div>
        <div style={styles.summaryCard}>
          <Clock style={{ width: 18, height: 18, color: '#D97706' }} />
          <div>
            <div style={styles.summaryVal}>{openCount + inProgressCount}</div>
            <div style={styles.summaryLabel}>Active / Pending</div>
          </div>
        </div>
        <div style={styles.summaryCard}>
          <CheckCircle2 style={{ width: 18, height: 18, color: '#16A34A' }} />
          <div>
            <div style={styles.summaryVal}>{resolvedCount}</div>
            <div style={styles.summaryLabel}>Resolved</div>
          </div>
        </div>
        <div style={styles.summaryCard}>
          <AlertTriangle style={{ width: 18, height: 18, color: '#DC2626' }} />
          <div>
            <div style={styles.summaryVal}>{escalatedCount}</div>
            <div style={styles.summaryLabel}>Escalated</div>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div style={styles.controlBar}>
        <div style={styles.searchBox}>
          <Search style={{ width: 15, height: 15, color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search ticket ID, title, category, village..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.filterGroup}>
          <Filter style={{ width: 14, height: 14, color: '#64748B' }} />
          {['All', 'Open', 'In Progress', 'Resolved', 'Escalated'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{ ...styles.filterBtn, ...(statusFilter === st ? styles.filterBtnActive : {}) }}
              className="btn-interactive"
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={styles.card}>
        {loading ? (
          <div style={styles.loadingBox}>
            <Loader2 style={{ width: 20, height: 20, color: '#2563EB', animation: 'spin 1s linear infinite' }} />
            <span>Loading complaints from Supabase...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyBox}>No complaints found matching your criteria.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Ticket / ID</th>
                <th style={styles.th}>Title</th>
                <th style={styles.th}>Village</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Priority</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Citizen</th>
                <th style={styles.th}>Date</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const villageObj = villages[c.village_id] || {}
                const citizenObj = profiles[c.citizen_id] || {}
                return (
                  <tr key={c.id} style={{ ...styles.tr, cursor: 'pointer' }} onClick={() => setSelectedComplaint(c)}>
                    <td style={styles.tdMono}>
                      {c.ticket_number || (typeof c.id === 'string' ? c.id.slice(0, 8) : `TKT-${c.id}`)}
                    </td>
                    <td style={styles.tdBold}>{c.title || c.description || 'General Grievance'}</td>
                    <td style={styles.td}>{villageObj.village_name || '—'}</td>
                    <td style={styles.tdMuted}>{c.category || 'General'}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.priorityBadge,
                          color: c.priority === 'High' || c.priority === 'Critical' ? '#B91C1C' : c.priority === 'Medium' ? '#B45309' : '#15803D',
                          background: c.priority === 'High' || c.priority === 'Critical' ? '#FEE2E2' : c.priority === 'Medium' ? '#FEF3C7' : '#DCFCE7',
                        }}
                      >
                        {c.priority || 'Normal'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          background:
                            c.status === 'Resolved'
                              ? '#DCFCE7'
                              : c.status === 'In Progress'
                              ? '#FEF3C7'
                              : c.is_escalated
                              ? '#FEE2E2'
                              : '#EFF6FF',
                          color:
                            c.status === 'Resolved'
                              ? '#15803D'
                              : c.status === 'In Progress'
                              ? '#B45309'
                              : c.is_escalated
                              ? '#B91C1C'
                              : '#1D4ED8',
                        }}
                      >
                        {c.is_escalated ? 'Escalated' : c.status || 'Open'}
                      </span>
                    </td>
                    <td style={styles.tdMuted}>{citizenObj.name || 'Anonymous'}</td>
                    <td style={styles.tdMono}>{formatDate(c.created_at)}</td>
                    <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedComplaint(c) }}
                          style={styles.viewBtn}
                          title="View Details"
                        >
                          <Eye style={{ width: 15, height: 15 }} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteComplaint(c) }}
                          style={styles.deleteBtn}
                          title="Delete Complaint"
                          disabled={deleting === c.id}
                        >
                          <Trash2 style={{ width: 15, height: 15 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Complaint Detail Modal */}
      {selectedComplaint && (
        <ComplaintDetailModal
          complaint={selectedComplaint}
          citizen={profiles[selectedComplaint.citizen_id]}
          village={villages[selectedComplaint.village_id]}
          onClose={() => setSelectedComplaint(null)}
          onDelete={deleteComplaint}
        />
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
  controlBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 10, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '0 14px', height: 42, width: 340 },
  searchInput: { border: 'none', outline: 'none', fontSize: 13, width: '100%' },
  filterGroup: { display: 'flex', alignItems: 'center', gap: 6, background: '#FFFFFF', border: '1px solid #E2E8F0', padding: 4, borderRadius: 12 },
  filterBtn: { padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer' },
  filterBtnActive: { background: '#2563EB', color: '#FFFFFF' },
  card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' },
  tr: { borderBottom: '1px solid #F1F5F9' },
  td: { padding: '12px 14px', color: '#0F172A' },
  tdBold: { padding: '12px 14px', fontWeight: 700, color: '#0F172A' },
  tdMuted: { padding: '12px 14px', color: '#64748B' },
  tdMono: { padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: '#64748B' },
  priorityBadge: { fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 6 },
  statusBadge: { fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 10px' },
  loadingBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 60, fontSize: 13, color: '#64748B' },
  emptyBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, fontSize: 13, color: '#94A3B8' },
  viewBtn: {
    width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0',
    background: '#F8FAFC', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    color: '#2563EB', cursor: 'pointer', transition: 'all 0.15s ease',
  },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 8, border: '1px solid #FECACA',
    background: '#FEF2F2', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    color: '#DC2626', cursor: 'pointer', transition: 'all 0.15s ease',
  },
}
