import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Approvals() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [actioningId, setActioningId] = useState(null)
  const [filter, setFilter] = useState('pending')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [reviewerNotes, setReviewerNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectModalId, setRejectModalId] = useState(null)

  useEffect(() => {
    loadRequests()
  }, [filter])

  async function loadRequests() {
    setLoading(true)
    setError('')
    try {
      let query = supabase
        .from('admin_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (filter !== 'all') query = query.eq('status', filter)

      const { data, error } = await query
      if (error) throw error
      setRequests(data || [])
    } catch (err) {
      setError(err.message || 'Failed to load admin requests.')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(r) {
    setActioningId(r.id)
    setError('')
    setSuccessMsg('')
    try {
      // Direct table update
      const { data, error: updateError } = await supabase
        .from('admin_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewer_notes: reviewerNotes || 'Verified & Approved by SuperAdmin',
        })
        .eq('id', r.id)
        .select()
        .single()

      if (updateError) throw updateError

      // Trigger Email Notification via Edge Function
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'approval',
            request: data || r,
          },
        })
      } catch (e) {
        console.warn('Email notification send attempted:', e)
      }

      setSuccessMsg(`Admin request for ${r.village_name} (${r.full_name || 'Sarpanch'}) has been APPROVED.`)
      setSelectedRequest(null)
      setReviewerNotes('')
      await loadRequests()
    } catch (err) {
      setError(err.message || 'Failed to approve request.')
    } finally {
      setActioningId(null)
    }
  }

  async function handleRejectConfirm(r) {
    if (!rejectionReason) {
      setError('Please provide a reason for rejecting this admin request.')
      return
    }

    setActioningId(r.id)
    setError('')
    setSuccessMsg('')
    try {
      const { data, error: updateError } = await supabase
        .from('admin_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: reviewerNotes || null,
        })
        .eq('id', r.id)
        .select()
        .single()

      if (updateError) throw updateError

      // Trigger Email Notification via Edge Function
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'rejection',
            request: data || r,
          },
        })
      } catch (e) {
        console.warn('Email notification send attempted:', e)
      }

      setSuccessMsg(`Admin request for ${r.village_name} has been REJECTED.`)
      setRejectModalId(null)
      setSelectedRequest(null)
      setRejectionReason('')
      setReviewerNotes('')
      await loadRequests()
    } catch (err) {
      setError(err.message || 'Failed to reject request.')
    } finally {
      setActioningId(null)
    }
  }

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <p className="eyebrow">request.gramseva.in &middot; super admin verification</p>
        <h1 style={styles.pageTitle}>Admin Approvals</h1>
        <p style={{ color: 'var(--stone)', fontSize: 13, marginTop: 4 }}>
          Review, verify document proofs, and approve or reject Village Sarpanch admin applications.
        </p>
      </header>

      {/* Filter Row */}
      <div style={styles.filterRow}>
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setError(''); setSuccessMsg(''); }}
            style={{ ...styles.filterPill, ...(filter === f ? styles.filterPillActive : {}) }}
          >
            {f}
          </button>
        ))}
      </div>

      {error && <div style={styles.errorBanner}>⚠️ {error}</div>}
      {successMsg && <div style={styles.successBanner}>✓ {successMsg}</div>}

      {loading && <p style={styles.muted}>Loading admin requests…</p>}

      {!loading && requests.length === 0 && (
        <div style={styles.emptyState}>
          <p style={{ margin: 0, color: 'var(--parchment)', fontSize: 15, fontWeight: 600 }}>
            No {filter !== 'all' ? filter : ''} requests found.
          </p>
          <p style={{ margin: '6px 0 0', color: 'var(--stone)', fontSize: 13 }}>
            When users apply for Sarpanch admin rights at request.gramseva.in, their applications will appear here for verification.
          </p>
        </div>
      )}

      {/* Requests List */}
      <div style={styles.list}>
        {requests.map((r) => (
          <div key={r.id} style={styles.card}>
            <div style={styles.cardMain}>
              <div style={styles.cardHeader}>
                <h3 style={styles.villageName}>{r.village_name || 'Village Admin Request'}</h3>
                <span style={{ ...styles.statusTag, ...statusStyle(r.status) }}>{r.status}</span>
              </div>

              <div style={styles.detailsGrid}>
                <div>
                  <span style={styles.detailLabel}>APPLICANT</span>
                  <div style={styles.detailValue}>{r.full_name || 'Sarpanch Applicant'}</div>
                </div>

                <div>
                  <span style={styles.detailLabel}>LOCATION</span>
                  <div style={styles.detailValue}>
                    {r.mandal ? `${r.mandal}, ` : ''}{r.district || ''}, {r.state || 'Telangana'}
                  </div>
                </div>

                <div>
                  <span style={styles.detailLabel}>PHONE</span>
                  <div style={styles.detailValue}>{r.phone || 'N/A'}</div>
                </div>

                <div>
                  <span style={styles.detailLabel}>AADHAAR</span>
                  <div style={styles.detailValue}>{r.aadhaar_number ? `•••• •••• ${r.aadhaar_number.slice(-4)}` : 'N/A'}</div>
                </div>
              </div>

              <div style={styles.metaRow}>
                <span>Submitted: {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                {r.reviewed_at && <span> &middot; Reviewed: {new Date(r.reviewed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
              </div>

              {/* Proof URLs */}
              {r.proof_url && (Array.isArray(r.proof_url) ? r.proof_url : [r.proof_url]).length > 0 && (
                <div style={styles.proofContainer}>
                  <span style={styles.detailLabel}>VERIFICATION PROOFS:</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {(Array.isArray(r.proof_url) ? r.proof_url : [r.proof_url]).map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.proofBadge}
                      >
                        📄 View Document Proof {idx + 1} ↗
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {r.rejection_reason && (
                <div style={styles.rejectionNote}>
                  <strong>Rejection Reason:</strong> {r.rejection_reason}
                </div>
              )}
            </div>

            {/* Actions for Pending Requests */}
            {r.status === 'pending' && (
              <div style={styles.actions}>
                <button
                  onClick={() => handleApprove(r)}
                  disabled={actioningId === r.id}
                  style={styles.approveBtn}
                >
                  {actioningId === r.id ? 'Processing…' : '✓ Approve Sarpanch'}
                </button>

                <button
                  onClick={() => setRejectModalId(r.id)}
                  disabled={actioningId === r.id}
                  style={styles.rejectBtn}
                >
                  ✕ Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reject Modal */}
      {rejectModalId && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Reject Admin Request</h3>
            <p style={{ fontSize: 13, color: 'var(--stone)', marginBottom: 16 }}>
              Please specify the reason for rejection. An automated email will be sent to the applicant.
            </p>

            <textarea
              placeholder="e.g. Aadhaar proof document is blurry / Invalid Village Sarpanch seal"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              style={styles.textarea}
              autoFocus
            />

            <div style={styles.modalActions}>
              <button
                onClick={() => { setRejectModalId(null); setRejectionReason(''); }}
                style={styles.cancelBtn}
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  const r = requests.find((req) => req.id === rejectModalId)
                  if (r) handleRejectConfirm(r)
                }}
                disabled={actioningId === rejectModalId}
                style={styles.confirmRejectBtn}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function statusStyle(status) {
  if (status === 'pending') return { color: '#C9601E', backgroundColor: 'rgba(201,96,30,0.12)', borderColor: 'rgba(201,96,30,0.4)' }
  if (status === 'approved') return { color: '#5C8369', backgroundColor: 'rgba(92,131,105,0.12)', borderColor: 'rgba(92,131,105,0.4)' }
  return { color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)' }
}

const styles = {
  pageTitle: { fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, margin: '6px 0 0', color: 'var(--parchment)' },
  filterRow: { display: 'flex', gap: 8, marginBottom: 20 },
  filterPill: {
    background: 'none',
    border: '1px solid var(--border-strong)',
    color: 'var(--stone)',
    borderRadius: 20,
    padding: '6px 16px',
    fontSize: 12.5,
    textTransform: 'capitalize',
    cursor: 'pointer',
  },
  filterPillActive: {
    background: 'var(--terracotta)',
    color: '#fff',
    borderColor: 'var(--terracotta)',
    fontWeight: 600,
  },
  errorBanner: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
    padding: '12px 16px',
    borderRadius: 8,
    fontSize: 13.5,
    marginBottom: 20,
  },
  successBanner: {
    background: 'rgba(92, 131, 105, 0.15)',
    border: '1px solid rgba(92, 131, 105, 0.4)',
    color: '#4ade80',
    padding: '12px 16px',
    borderRadius: 8,
    fontSize: 13.5,
    marginBottom: 20,
  },
  emptyState: {
    border: '1px dashed var(--border-strong)',
    borderRadius: 12,
    padding: '40px 24px',
    textAlign: 'center',
    background: 'var(--surface)',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: {
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'var(--surface)',
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 24,
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
  cardMain: { flex: 1 },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  villageName: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--parchment)' },
  statusTag: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    border: '1px solid',
    borderRadius: 20,
    padding: '3px 10px',
    fontWeight: 600,
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
    background: 'var(--surface-raised)',
    padding: '12px 16px',
    borderRadius: 8,
    marginBottom: 12,
  },
  detailLabel: { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--stone)', letterSpacing: '0.05em' },
  detailValue: { fontSize: 13, fontWeight: 600, color: 'var(--parchment)', marginTop: 2 },
  metaRow: { fontSize: 12, color: 'var(--stone)', marginBottom: 12 },
  proofContainer: { marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' },
  proofBadge: {
    fontSize: 12,
    color: '#60a5fa',
    background: 'rgba(96, 165, 250, 0.1)',
    border: '1px solid rgba(96, 165, 250, 0.3)',
    borderRadius: 6,
    padding: '6px 12px',
    fontWeight: 500,
    display: 'inline-block',
  },
  rejectionNote: {
    marginTop: 12,
    padding: '10px 14px',
    background: 'rgba(239, 68, 68, 0.1)',
    borderLeft: '3px solid #ef4444',
    borderRadius: 4,
    fontSize: 13,
    color: '#fca5a5',
  },
  actions: { display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, minWidth: 140 },
  approveBtn: {
    background: '#166534',
    color: '#ffffff',
    border: '1px solid #22c55e',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
    boxShadow: '0 2px 6px rgba(34, 197, 94, 0.2)',
  },
  rejectBtn: {
    background: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: 8,
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 20,
  },
  modalContent: {
    background: 'var(--surface-raised)',
    border: '1px solid var(--border-strong)',
    borderRadius: 16,
    padding: 24,
    maxWidth: 480,
    width: '100%',
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
  },
  modalTitle: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: 'var(--parchment)' },
  textarea: {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border-strong)',
    borderRadius: 8,
    padding: 12,
    color: 'var(--parchment)',
    fontSize: 13.5,
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'vertical',
    marginBottom: 16,
  },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: {
    background: 'none',
    border: '1px solid var(--border-strong)',
    color: 'var(--stone)',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer',
  },
  confirmRejectBtn: {
    background: '#dc2626',
    border: 'none',
    color: '#ffffff',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  muted: { color: 'var(--stone)', fontSize: 13 },
}
