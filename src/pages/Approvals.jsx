import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function Approvals() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioningId, setActioningId] = useState(null)
  const [filter, setFilter] = useState('pending')
  const { session } = useAuth()

  useEffect(() => {
    loadRequests()
  }, [filter])

  async function loadRequests() {
    setLoading(true)
    setError('')
    try {
      let query = supabase
        .from('admin_requests')
        .select('id, user_id, phone, village_name, district, state, proof_url, status, created_at, reviewed_at')
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

  async function handleApprove(requestId) {
    setActioningId(requestId)
    setError('')
    try {
      const { data, error } = await supabase.rpc('svc_approve_admin_request', {
        p_request_id: requestId,
        p_reviewer_id: session.user.id,
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Approval failed')
      await loadRequests()
    } catch (err) {
      setError(err.message || 'Failed to approve request.')
    } finally {
      setActioningId(null)
    }
  }

  async function handleReject(requestId) {
    setActioningId(requestId)
    setError('')
    try {
      const { data, error } = await supabase.rpc('svc_reject_admin_request', {
        p_request_id: requestId,
        p_reviewer_id: session.user.id,
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Rejection failed')
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
        <p className="eyebrow">request.gramseva.in &middot; review queue</p>
        <h1 style={styles.pageTitle}>Admin Requests</h1>
      </header>

      <div style={styles.filterRow}>
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ ...styles.filterPill, ...(filter === f ? styles.filterPillActive : {}) }}
          >
            {f}
          </button>
        ))}
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {loading && <p style={styles.muted}>Loading requests…</p>}

      {!loading && requests.length === 0 && (
        <div style={styles.emptyState}>
          <p style={{ margin: 0, color: 'var(--parchment)', fontSize: 14 }}>No {filter !== 'all' ? filter : ''} requests.</p>
          <p style={{ margin: '4px 0 0', color: 'var(--stone)', fontSize: 13 }}>
            New requests submitted at request.gramseva.in will appear here.
          </p>
        </div>
      )}

      <div style={styles.list}>
        {requests.map((r) => (
          <div key={r.id} style={styles.card}>
            <div style={styles.cardMain}>
              <div style={styles.cardHeader}>
                <h3 style={styles.villageName}>{r.village_name}</h3>
                <span style={{ ...styles.statusTag, ...statusStyle(r.status) }}>{r.status}</span>
              </div>
              <p style={styles.meta}>{r.district}, {r.state} &middot; {r.phone || 'no phone on file'}</p>
              <p style={styles.meta}>
                Submitted {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                {r.reviewed_at && ` · Reviewed ${new Date(r.reviewed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
              </p>
              {r.proof_url && (
                <a href={r.proof_url} target="_blank" rel="noreferrer" style={styles.proofLink}>
                  View submitted proof →
                </a>
              )}
            </div>

            {r.status === 'pending' && (
              <div style={styles.actions}>
                <button
                  onClick={() => handleApprove(r.id)}
                  disabled={actioningId === r.id}
                  style={styles.approveBtn}
                >
                  {actioningId === r.id ? '…' : 'Approve'}
                </button>
                <button
                  onClick={() => handleReject(r.id)}
                  disabled={actioningId === r.id}
                  style={styles.rejectBtn}
                >
                  {actioningId === r.id ? '…' : 'Reject'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function statusStyle(status) {
  if (status === 'pending') return { color: '#C9601E', borderColor: 'rgba(201,96,30,0.4)' }
  if (status === 'approved') return { color: '#5C8369', borderColor: 'rgba(92,131,105,0.4)' }
  return { color: '#8A8270', borderColor: 'var(--border-strong)' }
}

const styles = {
  pageTitle: { fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, margin: '6px 0 0' },
  filterRow: { display: 'flex', gap: 8, marginBottom: 20 },
  filterPill: {
    background: 'none',
    border: '1px solid var(--border-strong)',
    color: 'var(--stone)',
    borderRadius: 20,
    padding: '6px 14px',
    fontSize: 12.5,
    textTransform: 'capitalize',
    cursor: 'pointer',
  },
  filterPillActive: {
    background: 'var(--surface)',
    color: 'var(--parchment)',
    borderColor: 'var(--border-strong)',
  },
  errorBanner: {
    background: 'rgba(201,96,30,0.1)',
    border: '1px solid rgba(201,96,30,0.3)',
    color: '#C9601E',
    padding: '10px 14px',
    borderRadius: 4,
    fontSize: 13,
    marginBottom: 20,
  },
  emptyState: {
    border: '1px dashed var(--border-strong)',
    borderRadius: 4,
    padding: '28px 20px',
    textAlign: 'center',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    border: '1px solid var(--border)',
    borderRadius: 4,
    background: 'var(--surface)',
    padding: '16px 18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  cardMain: { flex: 1 },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 },
  villageName: { fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: 0 },
  statusTag: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    border: '1px solid',
    borderRadius: 20,
    padding: '2px 9px',
  },
  meta: { fontSize: 12.5, color: 'var(--stone)', margin: '2px 0' },
  proofLink: { fontSize: 12.5, color: 'var(--terracotta)', display: 'inline-block', marginTop: 6 },
  actions: { display: 'flex', gap: 8, flexShrink: 0 },
  approveBtn: {
    background: 'var(--green)',
    color: 'var(--parchment)',
    border: '1px solid var(--green-bright)',
    borderRadius: 3,
    padding: '7px 14px',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
  rejectBtn: {
    background: 'none',
    color: 'var(--stone)',
    border: '1px solid var(--border-strong)',
    borderRadius: 3,
    padding: '7px 14px',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
  muted: { color: 'var(--stone)', fontSize: 13 },
}
