import { useState } from 'react'
import { useAdminRequests } from '../hooks/useAdminRequests'
import { supabase, API_BASE_URL } from '../lib/supabase'
import AdminRequestModal from '../components/AdminRequestModal'
import PilotLinkModal from '../components/PilotLinkModal'
import { Search, CheckCircle2, XCircle, Clock, Eye, Check, X, Sparkles, RefreshCw, Loader2, Hash } from 'lucide-react'

export default function Approvals() {
  const [filter, setFilter] = useState('pending')
  const { requests, stats, loading, refresh } = useAdminRequests(filter)
  const [search, setSearch] = useState('')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [pilotRequest, setPilotRequest] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType] = useState('success')

  function showToast(msg, type = 'success') {
    setToastMsg(msg)
    setToastType(type)
    setTimeout(() => setToastMsg(''), 5000)
  }

  async function handleApprove(req, notes) {
    setActionLoading(true)
    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token

      if (jwt) {
        // Call server-side API for full workflow (village creation, invitation, email, FCM)
        const resp = await fetch(`${API_BASE_URL}/admin-request-action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            action: 'approve',
            requestId: req.id,
            notes: notes || 'Verified & Approved by SuperAdmin',
          }),
        })

        const result = await resp.json()
        if (result.success) {
          showToast(`✅ Approved: ${req.full_name} (${req.village_name}). Invitation sent to ${req.email}.`)
        } else {
          // Fallback: direct Supabase update
          await directApprove(req, notes)
        }
      } else {
        // Fallback: direct Supabase update
        await directApprove(req, notes)
      }

      setSelectedRequest(null)
      refresh()
    } catch (err) {
      console.error('Approve error:', err)
      // Fallback
      await directApprove(req, notes)
      setSelectedRequest(null)
      refresh()
    } finally {
      setActionLoading(false)
    }
  }

  async function directApprove(req, notes) {
    const payload = {
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewer_notes: notes || 'Verified & Approved by SuperAdmin',
    }
    await supabase.from('admin_requests').update(payload).eq('id', req.id)
    showToast(`Approved: ${req.full_name} (${req.village_name}).`)
  }

  async function handleReject(req, reason) {
    setActionLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token

      if (jwt) {
        const resp = await fetch(`${API_BASE_URL}/admin-request-action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            action: 'reject',
            requestId: req.id,
            reason: reason || 'Request could not be approved at this time.',
          }),
        })

        const result = await resp.json()
        if (result.success) {
          showToast(`Rejected: ${req.full_name} (${req.village_name}). Notification sent.`, 'error')
        } else {
          await directReject(req, reason)
        }
      } else {
        await directReject(req, reason)
      }

      setSelectedRequest(null)
      refresh()
    } catch (err) {
      console.error('Reject error:', err)
      await directReject(req, reason)
      setSelectedRequest(null)
      refresh()
    } finally {
      setActionLoading(false)
    }
  }

  async function directReject(req, reason) {
    const payload = {
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    }
    await supabase.from('admin_requests').update(payload).eq('id', req.id)
    showToast(`Rejected: ${req.full_name} (${req.village_name}).`, 'error')
  }

  const filteredRequests = requests.filter(
    (r) =>
      (r.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.village_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.district || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.request_id || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.email || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Admin Verification Requests</h1>
          <p style={styles.pageSubtitle}>
            Review and approve village Sarpanch portal credentials · Real-time sync enabled
            <span style={styles.dbTag}>LIVE · sompzqwvegygtpsrlhzt</span>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Stats Pills */}
          <div style={styles.statsPill}>
            <span style={{ ...styles.statDot, background: '#F59E0B' }} />
            <span style={styles.statLabel}>Pending</span>
            <span style={styles.statValue}>{stats.pending}</span>
          </div>
          <div style={styles.statsPill}>
            <span style={{ ...styles.statDot, background: '#22C55E' }} />
            <span style={styles.statLabel}>Approved</span>
            <span style={styles.statValue}>{stats.approved}</span>
          </div>
          <div style={styles.statsPill}>
            <span style={{ ...styles.statDot, background: '#EF4444' }} />
            <span style={styles.statLabel}>Rejected</span>
            <span style={styles.statValue}>{stats.rejected}</span>
          </div>
          <button onClick={refresh} style={styles.refreshBtn} className="btn-interactive">
            <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
          </button>
        </div>
      </div>

      {toastMsg && (
        <div style={{ ...styles.toast, background: toastType === 'error' ? '#FEE2E2' : '#DCFCE7', borderColor: toastType === 'error' ? '#FCA5A5' : '#86EFAC', color: toastType === 'error' ? '#991B1B' : '#166534' }}>
          {toastType === 'error' ? <XCircle style={{ width: 16, height: 16 }} /> : <CheckCircle2 style={{ width: 16, height: 16 }} />}
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer' }}>
            <X style={{ width: 14, height: 14 }} />
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
            {stats.pending > 0 && <span style={styles.tabBadge}>{stats.pending}</span>}
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
            All ({stats.total})
          </button>
        </div>

        {/* Search */}
        <div style={styles.searchBox}>
          <Search style={{ width: 14, height: 14, color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Filter by name, village, district, ID, email..."
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
                <th style={styles.th}>Request ID</th>
                <th style={styles.th}>Applicant</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Phone</th>
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
                  <td style={styles.tdMono}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Hash style={{ width: 10, height: 10, color: '#94A3B8' }} />
                      {r.request_id || r.id?.slice(0, 8)}
                    </div>
                  </td>
                  <td style={styles.tdBold}>{r.full_name || 'Admin Applicant'}</td>
                  <td style={styles.tdMuted}>{r.email || '—'}</td>
                  <td style={styles.tdMuted}>{r.phone || '—'}</td>
                  <td style={styles.td}>{r.village_name}</td>
                  <td style={styles.tdMuted}>{r.district}</td>
                  <td style={styles.tdMuted}>{r.state || 'Andhra Pradesh'}</td>
                  <td style={styles.tdMono}>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
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
                          <button onClick={() => handleApprove(r, 'Approved')} style={styles.approveBtn} className="btn-interactive" disabled={actionLoading}>
                            <Check style={{ width: 13, height: 13 }} /> Approve
                          </button>
                          <button onClick={() => handleReject(r, 'Rejected')} style={styles.rejectBtn} className="btn-interactive" disabled={actionLoading}>
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
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
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
  statsPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 10,
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    fontSize: 11.5,
  },
  statDot: { width: 6, height: 6, borderRadius: 99 },
  statLabel: { color: '#64748B', fontWeight: 600 },
  statValue: { fontWeight: 800, color: '#0F172A' },
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
    padding: '10px 16px',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 600,
    border: '1px solid',
  },
  controlBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  tabGroup: { display: 'flex', alignItems: 'center', gap: 4, background: '#FFFFFF', padding: 4, borderRadius: 12, border: '1px solid #E2E8F0' },
  tabBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer' },
  tabBtnActive: { background: '#2563EB', color: '#FFFFFF' },
  tabBadge: { fontSize: 10, fontWeight: 800, background: 'rgba(255,255,255,0.25)', borderRadius: 99, padding: '1px 6px', marginLeft: 2 },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '0 12px', height: 38, width: 320 },
  searchInput: { border: 'none', outline: 'none', fontSize: 12.5, width: '100%' },
  card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' },
  tr: { borderBottom: '1px solid #F1F5F9' },
  td: { padding: '12px 14px', color: '#0F172A' },
  tdBold: { padding: '12px 14px', fontWeight: 700, color: '#0F172A' },
  tdMuted: { padding: '12px 14px', color: '#64748B', fontSize: 12 },
  tdMono: { padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#64748B' },
  statusBadge: { fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 10px', textTransform: 'capitalize' },
  btnRow: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  pilotBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: '#7C3AED', background: '#F3E8FF', border: '1px solid #E9D5FF', cursor: 'pointer' },
  viewBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, color: '#2563EB', background: '#EFF6FF', border: 'none', cursor: 'pointer' },
  approveBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: '#FFFFFF', background: '#2563EB', border: 'none', cursor: 'pointer' },
  rejectBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: '#EF4444', background: '#FEE2E2', border: 'none', cursor: 'pointer' },
  loadingBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 60, fontSize: 13, color: '#64748B' },
  emptyBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, fontSize: 13, color: '#94A3B8' },
}
