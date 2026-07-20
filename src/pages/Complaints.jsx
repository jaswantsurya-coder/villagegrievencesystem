import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AlertCircle, Search, Eye, Filter } from 'lucide-react'

export default function Complaints() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  useEffect(() => {
    loadComplaints()
  }, [])

  async function loadComplaints() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('complaints').select('*').limit(20)
      if (!error && data && data.length > 0) {
        setComplaints(data)
      } else {
        // Fallback mock complaints matching prompt table columns
        setComplaints([
          { id: 'GS-2025-18573', village: 'Vizianagaram', category: 'Roads & Infrastructure', priority: 'High', department: 'Public Works', status: 'In Progress', officer: 'Insp. V. Ramesh', created: '17 May 2025' },
          { id: 'GS-2025-18572', village: 'Srikakulam', category: 'Water Supply', priority: 'High', department: 'Water Board', status: 'Open', officer: 'Eng. K. Suresh', created: '17 May 2025' },
          { id: 'GS-2025-18571', village: 'West Godavari', category: 'Drainage & Sewage', priority: 'Medium', department: 'Sanitation', status: 'Resolved', officer: 'Off. M. Prasad', created: '16 May 2025' },
          { id: 'GS-2025-18570', village: 'YSR Kadapa', category: 'Electricity', priority: 'Low', department: 'Electricity Board', status: 'In Progress', officer: 'Insp. V. Ramesh', created: '16 May 2025' },
          { id: 'GS-2025-18569', village: 'Krishna', category: 'Street Lights', priority: 'High', department: 'Municipal Corp', status: 'Escalated', officer: 'Panchayat Lead', created: '15 May 2025' },
        ])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = complaints.filter(
    (c) =>
      (statusFilter === 'All' || c.status === statusFilter) &&
      (c.id.toLowerCase().includes(search.toLowerCase()) ||
        c.village.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Complaint Center</h1>
          <p style={styles.pageSubtitle}>Centralized Citizen Telemetry & SLA Resolution Tracker</p>
        </div>
      </div>

      <div style={styles.controlBar}>
        <div style={styles.searchBox}>
          <Search style={{ width: 15, height: 15, color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search ticket ID, village, category..."
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
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Ticket ID</th>
              <th style={styles.th}>Village</th>
              <th style={styles.th}>Category</th>
              <th style={styles.th}>Priority</th>
              <th style={styles.th}>Department</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Assigned Officer</th>
              <th style={styles.th}>Created Date</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} style={styles.tr}>
                <td style={styles.tdMono}>{c.id}</td>
                <td style={styles.tdBold}>{c.village}</td>
                <td style={styles.td}>{c.category}</td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.priorityBadge,
                      color: c.priority === 'High' ? '#B91C1C' : c.priority === 'Medium' ? '#B45309' : '#15803D',
                      background: c.priority === 'High' ? '#FEE2E2' : c.priority === 'Medium' ? '#FEF3C7' : '#DCFCE7',
                    }}
                  >
                    {c.priority}
                  </span>
                </td>
                <td style={styles.tdMuted}>{c.department}</td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.statusBadge,
                      background:
                        c.status === 'Resolved'
                          ? '#DCFCE7'
                          : c.status === 'In Progress'
                          ? '#FEF3C7'
                          : c.status === 'Escalated'
                          ? '#FEE2E2'
                          : '#EFF6FF',
                      color:
                        c.status === 'Resolved'
                          ? '#15803D'
                          : c.status === 'In Progress'
                          ? '#B45309'
                          : c.status === 'Escalated'
                          ? '#B91C1C'
                          : '#1D4ED8',
                    }}
                  >
                    {c.status}
                  </span>
                </td>
                <td style={styles.tdBold}>{c.officer}</td>
                <td style={styles.tdMono}>{c.created}</td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  <button style={styles.viewBtn}>
                    <Eye style={{ width: 13, height: 13 }} /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: 20 },
  header: { marginBottom: 4 },
  pageTitle: { fontSize: 22, fontWeight: 800, color: '#0F172A' },
  pageSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4 },
  controlBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 10, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '0 14px', height: 42, width: 340 },
  searchInput: { border: 'none', outline: 'none', fontSize: 13, width: '100%' },
  filterGroup: { display: 'flex', alignItems: 'center', gap: 6, background: '#FFFFFF', border: '1px solid #E2E8F0', padding: 4, borderRadius: 12 },
  filterBtn: { padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#64748B', background: 'none' },
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
  viewBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, color: '#2563EB', background: '#EFF6FF' },
}
