import { useEffect, useState } from 'react'
import { supabase, supabaseAux } from '../lib/supabase'
import AdminRequestModal from '../components/AdminRequestModal'
import PilotLinkModal from '../components/PilotLinkModal'
import { Search, CheckCircle2, XCircle, Clock, Eye, Check, X, Sparkles, RefreshCw, Loader2 } from 'lucide-react'

const BREVO_API_KEY = 'xsmtpsib-cfffd31dfdf28dafee3aee99eff62ad5d53feb62b9ed7eb8b07c9cf0311d2848-ds5mX4zI5UTsVk26'

export default function Approvals() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [pilotRequest, setPilotRequest] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  useEffect(() => {
    loadRequests()
  }, [filter])

  async function loadRequests() {
    setLoading(true)
    try {
      // Try primary db (sompzqwvegygtpsrlhzt) first, fallback to aux db (dtucrczgagpzjbbrwqit)
      let data = null

      let q1 = supabase.from('admin_requests').select('*').order('created_at', { ascending: false })
      if (filter !== 'all') q1 = q1.eq('status', filter)
      const res1 = await q1

      if (!res1.error && res1.data && res1.data.length > 0) {
        data = res1.data
      } else {
        // Fallback to aux db admin_requests
        let q2 = supabaseAux.from('admin_requests').select('*').order('created_at', { ascending: false })
        if (filter !== 'all') q2 = q2.eq('status', filter)
        const res2 = await q2
        if (!res2.error && res2.data) {
          data = res2.data
        }
      }

      setRequests(data || [])
    } catch (err) {
      console.error('Error loading requests:', err)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  async function sendBrevoNotification(type, reqData) {
    try {
      const subject =
        type === 'approval'
          ? `[GramSeva] 🎉 Admin Verification Request APPROVED — ${reqData.village_name}`
          : `[GramSeva] Admin Verification Request Update — ${reqData.village_name}`

      const htmlContent =
        type === 'approval'
          ? `<div style="font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;"><div style="background:#166534;padding:20px;text-align:center;color:white;border-radius:8px;"><h2 style="margin:0;">✓ Admin Access Approved!</h2></div><p style="padding-top:16px;">Dear <strong>${reqData.full_name || 'Applicant'}</strong>,</p><p>Your admin verification for <strong>${reqData.village_name}</strong> (${reqData.district}) has been approved by the Super Admin.</p></div>`
          : `<div style="font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;"><div style="background:#991b1b;padding:20px;text-align:center;color:white;border-radius:8px;"><h2 style="margin:0;">Request Rejected</h2></div><p style="padding-top:16px;">Dear <strong>${reqData.full_name || 'Applicant'}</strong>,</p><p>Your request for <strong>${reqData.village_name}</strong> could not be approved at this time.</p></div>`

      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'GramSeva Admin Portal', email: 'admin@gramseva.in' },
          to: [{ email: reqData.email || 'admin@gramseva.in', name: reqData.full_name || 'Applicant' }],
          subject,
          htmlContent,
        }),
      })
    } catch (err) {
      console.error('Brevo notification error:', err)
    }
  }

  async function handleApprove(req, notes) {
    setActionLoading(true)
    try {
      // Update in primary db first
      const payload = {
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewer_notes: notes || 'Verified & Approved by SuperAdmin',
      }
      await supabase.from('admin_requests').update(payload).eq('id', req.id)
      await supabaseAux.from('admin_requests').update(payload).eq('id', req.id)

      await sendBrevoNotification('approval', req)
      setToastMsg(`Approved request for ${req.full_name} (${req.village_name}). Brevo notification dispatched.`)
      setSelectedRequest(null)
      loadRequests()
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject(req, reason) {
    setActionLoading(true)
    try {
      const payload = {
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      }
      await supabase.from('admin_requests').update(payload).eq('id', req.id)
      await supabaseAux.from('admin_requests').update(payload).eq('id', req.id)

      await sendBrevoNotification('rejection', req)
      setToastMsg(`Rejected request for ${req.full_name} (${req.village_name}).`)
      setSelectedRequest(null)
      loadRequests()
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  const filteredRequests = requests.filter(
    (r) =>
      (r.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.village_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.district || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Admin Verification Requests</h1>
          <p style={styles.pageSubtitle}>
            Review and approve village Sarpanch portal credentials · Pilot link generator available
            <span style={styles.dbTag}>LIVE · sompzqwvegygtpsrlhzt</span>
          </p>
        </div>
        <button onClick={loadRequests} style={styles.refreshBtn} className="btn-interactive">
          <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
        </button>
      </div>

      {toastMsg && (
        <div style={styles.toast}>
          <CheckCircle2 style={{ width: 16, height: 16, color: '#166534' }} />
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer' }}>
            <X style={{ width: 14, height: 14, color: '#166534' }} />
          </button>
        </div>
      )}

      {/* Control Bar */}
      <div style={styles.controlBar}>
        {/* Tabs */}
        <div style={styles.tabGroup}>
          <button
            onClick={() => setFilter('pending')}
            style={{ ...styles.tabBtn, ...(filter === 'pending' ? styles.tabBtnActive : {}) }}
            className="btn-interactive"
          >
            <Clock style={{ width: 14, height: 14 }} /> Pending
          </button>
          <button
            onClick={() => setFilter('approved')}
            style={{ ...styles.tabBtn, ...(filter === 'approved' ? styles.tabBtnActive : {}) }}
            className="btn-interactive"
          >
            <CheckCircle2 style={{ width: 14, height: 14 }} /> Approved
          </button>
          <button
            onClick={() => setFilter('rejected')}
            style={{ ...styles.tabBtn, ...(filter === 'rejected' ? styles.tabBtnActive : {}) }}
            className="btn-interactive"
          >
            <XCircle style={{ width: 14, height: 14 }} /> Rejected
          </button>
          <button
            onClick={() => setFilter('all')}
            style={{ ...styles.tabBtn, ...(filter === 'all' ? styles.tabBtnActive : {}) }}
            className="btn-interactive"
          >
            All Requests
          </button>
        </div>

        {/* Search */}
        <div style={styles.searchBox}>
          <Search style={{ width: 14, height: 14, color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Filter applicant, village, district..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </div>

      {/* Table */}
      <div style={styles.card}>
        {loading ? (
          <div style={styles.loadingBox}>
            <Loader2 style={{ width: 20, height: 20, color: '#2563EB', animation: 'spin 1s linear infinite' }} />
            <span>Loading admin requests from Supabase...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div style={styles.emptyBox}>No admin requests found matching criteria.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Applicant</th>
                <th style={styles.th}>Village</th>
                <th style={styles.th}>District</th>
                <th style={styles.th}>State</th>
                <th style={styles.th}>Submitted</th>
                <th style={styles.th}>Status</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((r) => (
                <tr key={r.id} style={styles.tr}>
                  <td style={styles.tdBold}>{r.full_name || 'Admin Applicant'}</td>
                  <td style={styles.td}>{r.village_name}</td>
                  <td style={styles.tdMuted}>{r.district}</td>
                  <td style={styles.tdMuted}>{r.state || 'Andhra Pradesh'}</td>
                  <td style={styles.tdMono}>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                  </td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        background: r.status === 'approved' ? '#DCFCE7' : r.status === 'rejected' ? '#FEE2E2' : '#FEF3C7',
                        color: r.status === 'approved' ? '#15803D' : r.status === 'rejected' ? '#B91C1C' : '#B45309',
                      }}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <div style={styles.btnRow}>
                      <button onClick={() => setPilotRequest(r)} style={styles.pilotBtn} className="btn-interactive">
                        <Sparkles style={{ width: 12, height: 12 }} /> Pilot Link
                      </button>

                      <button onClick={() => setSelectedRequest(r)} style={styles.viewBtn} className="btn-interactive">
                        <Eye style={{ width: 13, height: 13 }} /> View
                      </button>

                      {r.status === 'pending' && (
                        <>
                          <button onClick={() => handleApprove(r, 'Approved')} style={styles.approveBtn} className="btn-interactive">
                            <Check style={{ width: 13, height: 13 }} /> Approve
                          </button>
                          <button onClick={() => handleReject(r, 'Rejected')} style={styles.rejectBtn} className="btn-interactive">
                            <X style={{ width: 13, height: 13 }} /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedRequest && (
        <AdminRequestModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          loading={actionLoading}
        />
      )}

      {pilotRequest && (
        <PilotLinkModal
          request={pilotRequest}
          onClose={() => setPilotRequest(null)}
        />
      )}
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: 20 },
  pageHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
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
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#DCFCE7',
    border: '1px solid #86EFAC',
    color: '#166534',
    padding: '10px 16px',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 600,
  },
  controlBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  tabGroup: { display: 'flex', alignItems: 'center', gap: 4, background: '#FFFFFF', padding: 4, borderRadius: 12, border: '1px solid #E2E8F0' },
  tabBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer' },
  tabBtnActive: { background: '#2563EB', color: '#FFFFFF' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '0 12px', height: 38, width: 280 },
  searchInput: { border: 'none', outline: 'none', fontSize: 12.5, width: '100%' },
  card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' },
  tr: { borderBottom: '1px solid #F1F5F9' },
  td: { padding: '12px 14px', color: '#0F172A' },
  tdBold: { padding: '12px 14px', fontWeight: 700, color: '#0F172A' },
  tdMuted: { padding: '12px 14px', color: '#64748B' },
  tdMono: { padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: '#64748B' },
  statusBadge: { fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 10px', textTransform: 'capitalize' },
  btnRow: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  pilotBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: '#7C3AED', background: '#F3E8FF', border: '1px solid #E9D5FF', cursor: 'pointer' },
  viewBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, color: '#2563EB', background: '#EFF6FF', border: 'none', cursor: 'pointer' },
  approveBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: '#FFFFFF', background: '#2563EB', border: 'none', cursor: 'pointer' },
  rejectBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: '#EF4444', background: '#FEE2E2', border: 'none', cursor: 'pointer' },
  loadingBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 60, fontSize: 13, color: '#64748B' },
  emptyBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, fontSize: 13, color: '#94A3B8' },
}
