import { useState } from 'react'
import { Users, Search, UserCheck, Shield, MapPin, Calendar } from 'lucide-react'

const mockCitizens = [
  { id: 'CZ-901', name: 'K. Srinivasa Rao', village: 'Bhimavaram', district: 'West Godavari', phone: '+91 98480 11223', status: 'Active', registered: '12 Jan 2025' },
  { id: 'CZ-902', name: 'M. Padma', village: 'Tadepalligudem', district: 'West Godavari', phone: '+91 98480 22334', status: 'Active', registered: '15 Jan 2025' },
  { id: 'CZ-903', name: 'G. Appa Rao', village: 'Rajahmundry Rural', district: 'East Godavari', phone: '+91 98480 33445', status: 'Active', registered: '18 Jan 2025' },
  { id: 'CZ-904', name: 'T. Vani Kumari', village: 'Pithapuram', district: 'Kakinada', phone: '+91 98480 44556', status: 'Awaiting Join', registered: '22 Jan 2025' },
  { id: 'CZ-905', name: 'B. Satish', village: 'Narasapur', district: 'West Godavari', phone: '+91 98480 55667', status: 'Active', registered: '25 Jan 2025' },
]

export default function Citizens() {
  const [search, setSearch] = useState('')

  const filtered = mockCitizens.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.village.toLowerCase().includes(search.toLowerCase()) ||
      c.district.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Citizen Network</h1>
          <p style={styles.pageSubtitle}>Total Registered Citizens: 24,892 across connected Panchayats</p>
        </div>
      </div>

      <div style={styles.controlBar}>
        <div style={styles.searchBox}>
          <Search style={{ width: 15, height: 15, color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search citizen name, village, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={styles.countBadge}>Showing {filtered.length} Citizens</div>
      </div>

      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Citizen ID</th>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Village</th>
              <th style={styles.th}>District</th>
              <th style={styles.th}>Phone</th>
              <th style={styles.th}>Status</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Registered Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} style={styles.tr}>
                <td style={styles.tdMono}>{c.id}</td>
                <td style={styles.tdBold}>{c.name}</td>
                <td style={styles.td}>{c.village}</td>
                <td style={styles.tdMuted}>{c.district}</td>
                <td style={styles.tdMuted}>{c.phone}</td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.statusBadge,
                      background: c.status === 'Active' ? '#DCFCE7' : '#FEF3C7',
                      color: c.status === 'Active' ? '#15803D' : '#B45309',
                    }}
                  >
                    {c.status}
                  </span>
                </td>
                <td style={{ ...styles.tdMono, textAlign: 'right' }}>{c.registered}</td>
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
