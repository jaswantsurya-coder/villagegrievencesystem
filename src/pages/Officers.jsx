import { useState } from 'react'
import { ShieldCheck, Search, Building2, Phone, Mail, Award } from 'lucide-react'

const mockOfficers = [
  { id: 'OFF-101', name: 'Inspector V. Ramesh', department: 'Roads & Infrastructure', assignedVillage: 'Bhimavaram', district: 'West Godavari', phone: '+91 94401 12345', status: 'Active', resolved: 142 },
  { id: 'OFF-102', name: 'Engineer K. Suresh', department: 'Water Supply', assignedVillage: 'Tadepalligudem', district: 'West Godavari', phone: '+91 94401 23456', status: 'Active', resolved: 128 },
  { id: 'OFF-103', name: 'Officer M. Prasad', department: 'Electricity & Lighting', assignedVillage: 'Rajahmundry Rural', district: 'East Godavari', phone: '+91 94401 34567', status: 'Active', resolved: 110 },
  { id: 'OFF-104', name: 'Sanitation Lead P. Raju', department: 'Drainage & Sewage', assignedVillage: 'Pithapuram', district: 'Kakinada', phone: '+91 94401 45678', status: 'Active', resolved: 95 },
  { id: 'OFF-105', name: 'Supervisor A. Naidu', department: 'Healthcare & Public Safety', assignedVillage: 'Narasapur', district: 'West Godavari', phone: '+91 94401 56789', status: 'Pending Assignment', resolved: 64 },
]

export default function Officers() {
  const [search, setSearch] = useState('')

  const filtered = mockOfficers.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.department.toLowerCase().includes(search.toLowerCase()) ||
      o.assignedVillage.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Village Officers Directory</h1>
          <p style={styles.pageSubtitle}>Total Officers: 1,248 Field Inspectors & Panchayat Leads</p>
        </div>
      </div>

      <div style={styles.controlBar}>
        <div style={styles.searchBox}>
          <Search style={{ width: 15, height: 15, color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search officer name, department, village..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={styles.countBadge}>Showing {filtered.length} Officers</div>
      </div>

      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Officer ID</th>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Department</th>
              <th style={styles.th}>Assigned Village</th>
              <th style={styles.th}>District</th>
              <th style={styles.th}>Status</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Resolved Issues</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} style={styles.tr}>
                <td style={styles.tdMono}>{o.id}</td>
                <td style={styles.tdBold}>{o.name}</td>
                <td style={styles.td}>{o.department}</td>
                <td style={styles.tdBold}>{o.assignedVillage}</td>
                <td style={styles.tdMuted}>{o.district}</td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.statusBadge,
                      background: o.status === 'Active' ? '#DCFCE7' : '#FEF3C7',
                      color: o.status === 'Active' ? '#15803D' : '#B45309',
                    }}
                  >
                    {o.status}
                  </span>
                </td>
                <td style={{ ...styles.tdBold, textAlign: 'right' }}>{o.resolved}</td>
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
  controlBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  searchBox: { display: 'flex', alignItems: 'center', gap: 10, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '0 14px', height: 42, width: 340 },
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
  statusBadge: { fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 10px' },
}
