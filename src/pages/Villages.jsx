import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Building2, Search, Users, AlertCircle, Key, Award, ShieldCheck, Plus } from 'lucide-react'

export default function Villages() {
  const [villages, setVillages] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadVillages()
  }, [])

  async function loadVillages() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('villages').select('*').order('village_name')
      if (!error && data && data.length > 0) {
        setVillages(data)
      } else {
        // Fallback mock data
        setVillages([
          { id: 1, village_name: 'Bhimavaram', district: 'West Godavari', state: 'Andhra Pradesh', join_code: 'BHIM-534201', sarpanch_name: 'M. Venkata Rao', citizens: 4210, complaints: 142, score: 96, health: 'Optimal' },
          { id: 2, village_name: 'Tadepalligudem', district: 'West Godavari', state: 'Andhra Pradesh', join_code: 'TADE-534101', sarpanch_name: 'K. Ramachandra', citizens: 3890, complaints: 168, score: 93, health: 'Good' },
          { id: 3, village_name: 'Rajahmundry Rural', district: 'East Godavari', state: 'Andhra Pradesh', join_code: 'RAJA-533101', sarpanch_name: 'S. Satyanarayana', citizens: 5120, complaints: 210, score: 92, health: 'Good' },
          { id: 4, village_name: 'Pithapuram', district: 'Kakinada', state: 'Andhra Pradesh', join_code: 'PITH-533450', sarpanch_name: 'V. Subba Rao', citizens: 3450, complaints: 115, score: 90, health: 'Good' },
          { id: 5, village_name: 'Narasapur', district: 'West Godavari', state: 'Andhra Pradesh', join_code: 'NARA-534275', sarpanch_name: 'G. Nageswara Rao', citizens: 2980, complaints: 98, score: 89, health: 'Moderate' },
          { id: 6, village_name: 'Peddapudi', district: 'Prakasam', state: 'Andhra Pradesh', join_code: 'PEDD-523105', sarpanch_name: 'Ramesh Babu', citizens: 1850, complaints: 45, score: 88, health: 'Optimal' },
        ])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
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
          <p style={styles.pageSubtitle}>Connected Panchayats & Join Code Access Ledger</p>
        </div>
        <button style={styles.createBtn}>
          <Plus style={{ width: 16, height: 16 }} /> Create Village
        </button>
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
        <div style={styles.totalCount}>Showing {filtered.length} Villages</div>
      </div>

      {/* Grid */}
      <div style={styles.grid}>
        {filtered.map((v) => (
          <div key={v.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.iconBox}>
                <Building2 style={{ width: 18, height: 18, color: '#2563EB' }} />
              </div>
              <div style={styles.titleBox}>
                <h3 style={styles.villageName}>{v.village_name}</h3>
                <span style={styles.locationText}>{v.district}, {v.state || 'AP'}</span>
              </div>
              <span style={styles.healthBadge}>{v.health || 'Optimal'}</span>
            </div>

            <div style={styles.codeRow}>
              <Key style={{ width: 13, height: 13, color: '#64748B' }} />
              <span style={styles.codeLabel}>JOIN CODE:</span>
              <span style={styles.codeVal}>{v.join_code || 'GS-88491'}</span>
            </div>

            <div style={styles.sarpanchBox}>
              <span style={{ fontSize: 11, color: '#64748B' }}>Sarpanch:</span>
              <strong style={{ fontSize: 12.5, color: '#0F172A' }}>{v.sarpanch_name || 'Assigned Officer'}</strong>
            </div>

            <div style={styles.statsRow}>
              <div style={styles.statItem}>
                <Users style={{ width: 14, height: 14, color: '#2563EB' }} />
                <div>
                  <div style={styles.statVal}>{(v.citizens || 2400).toLocaleString()}</div>
                  <div style={styles.statLabel}>Citizens</div>
                </div>
              </div>

              <div style={styles.statItem}>
                <AlertCircle style={{ width: 14, height: 14, color: '#D97706' }} />
                <div>
                  <div style={styles.statVal}>{v.complaints || 120}</div>
                  <div style={styles.statLabel}>Complaints</div>
                </div>
              </div>

              <div style={styles.statItem}>
                <Award style={{ width: 14, height: 14, color: '#166534' }} />
                <div>
                  <div style={styles.statVal}>{v.score || 92}/100</div>
                  <div style={styles.statLabel}>Score</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
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
    width: 340,
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
    gap: 14,
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
  },
  healthBadge: {
    fontSize: 10.5,
    fontWeight: 700,
    color: '#15803D',
    background: '#DCFCE7',
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
