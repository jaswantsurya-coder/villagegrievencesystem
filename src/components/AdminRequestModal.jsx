import { useState } from 'react'
import { X, CheckCircle2, XCircle, FileText, ShieldCheck, Mail, Phone, ExternalLink } from 'lucide-react'

export default function AdminRequestModal({ request, onClose, onApprove, onReject, loading }) {
  const [reviewerNotes, setReviewerNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  if (!request) return null

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitleGroup}>
            <div style={styles.iconBox}>
              <ShieldCheck style={{ width: 20, height: 20, color: '#2563EB' }} />
            </div>
            <div>
              <h3 style={styles.modalTitle}>Admin Verification Details</h3>
              <p style={styles.modalSubtitle}>Request ID: #{request.id?.slice(0, 8)}</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Content Body */}
        <div style={styles.body}>
          {/* Applicant Summary Header */}
          <div style={styles.applicantCard}>
            <div style={styles.avatar}>
              {(request.full_name || 'Applicant').split(' ').map(n => n[0]).join('')}
            </div>
            <div style={styles.applicantDetails}>
              <h4 style={styles.applicantName}>{request.full_name || 'Sarpanch Applicant'}</h4>
              <p style={styles.applicantLocation}>
                {request.village_name}, {request.district}, {request.state || 'Andhra Pradesh'}
              </p>
            </div>
            <span
              style={{
                ...styles.statusTag,
                background: request.status === 'approved' ? '#DCFCE7' : request.status === 'rejected' ? '#FEE2E2' : '#FEF3C7',
                color: request.status === 'approved' ? '#15803D' : request.status === 'rejected' ? '#B91C1C' : '#B45309',
              }}
            >
              {request.status.toUpperCase()}
            </span>
          </div>

          {/* Document & Contact Verification Grid */}
          <div style={styles.sectionTitle}>Verification Status</div>
          <div style={styles.verificationGrid}>
            <div style={styles.verifyItem}>
              <FileText style={{ width: 15, height: 15, color: '#2563EB' }} />
              <div style={styles.verifyContent}>
                <span style={styles.verifyLabel}>Identity Proof</span>
                <span style={styles.verifyValue}>Aadhaar Card Uploaded</span>
              </div>
              <span style={styles.checkBadge}>
                <CheckCircle2 style={{ width: 13, height: 13 }} /> Verified
              </span>
            </div>

            <div style={styles.verifyItem}>
              <FileText style={{ width: 15, height: 15, color: '#2563EB' }} />
              <div style={styles.verifyContent}>
                <span style={styles.verifyLabel}>Village Proof</span>
                <span style={styles.verifyValue}>Grama Panchayat Certificate</span>
              </div>
              <span style={styles.checkBadge}>
                <CheckCircle2 style={{ width: 13, height: 13 }} /> Verified
              </span>
            </div>

            <div style={styles.verifyItem}>
              <Phone style={{ width: 15, height: 15, color: '#166534' }} />
              <div style={styles.verifyContent}>
                <span style={styles.verifyLabel}>Phone Verified</span>
                <span style={styles.verifyValue}>{request.phone || '+91 98765 43210'}</span>
              </div>
              <span style={styles.checkBadge}>
                <CheckCircle2 style={{ width: 13, height: 13 }} /> Verified
              </span>
            </div>

            <div style={styles.verifyItem}>
              <Mail style={{ width: 15, height: 15, color: '#166534' }} />
              <div style={styles.verifyContent}>
                <span style={styles.verifyLabel}>Email Verified</span>
                <span style={styles.verifyValue}>{request.email || 'applicant@gramseva.in'}</span>
              </div>
              <span style={styles.checkBadge}>
                <CheckCircle2 style={{ width: 13, height: 13 }} /> Verified
              </span>
            </div>
          </div>

          {/* Proof Preview Documents */}
          <div style={{ ...styles.sectionTitle, marginTop: 16 }}>Uploaded Documents</div>
          <div style={styles.docBox}>
            <div style={styles.docRow}>
              <FileText style={{ width: 16, height: 16, color: '#64748B' }} />
              <span style={{ fontSize: 13, flex: 1 }}>sarpanch_id_proof_v2.pdf</span>
              <a href="#" style={styles.docLink} onClick={(e) => e.preventDefault()}>
                View <ExternalLink style={{ width: 12, height: 12 }} />
              </a>
            </div>
            <div style={{ ...styles.docRow, borderTop: '1px solid #F1F5F9' }}>
              <FileText style={{ width: 16, height: 16, color: '#64748B' }} />
              <span style={{ fontSize: 13, flex: 1 }}>panchayat_approval_letter.pdf</span>
              <a href="#" style={styles.docLink} onClick={(e) => e.preventDefault()}>
                View <ExternalLink style={{ width: 12, height: 12 }} />
              </a>
            </div>
          </div>

          {/* Action Notes Input */}
          {request.status === 'pending' && (
            <div style={{ marginTop: 16 }}>
              {!showRejectForm ? (
                <div>
                  <label style={styles.inputLabel}>Reviewer Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Verified documents with MRO office..."
                    value={reviewerNotes}
                    onChange={(e) => setReviewerNotes(e.target.value)}
                    style={styles.textInput}
                  />
                </div>
              ) : (
                <div>
                  <label style={{ ...styles.inputLabel, color: '#B91C1C' }}>Rejection Reason (Required)</label>
                  <textarea
                    placeholder="e.g. Incomplete village seal on proof document..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    style={{ ...styles.textInput, height: 70, resize: 'none' }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>
            Close
          </button>

          {request.status === 'pending' && (
            <div style={{ display: 'flex', gap: 10 }}>
              {!showRejectForm ? (
                <>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    style={styles.rejectBtn}
                    disabled={loading}
                  >
                    <XCircle style={{ width: 15, height: 15 }} /> Reject
                  </button>
                  <button
                    onClick={() => onApprove(request, reviewerNotes)}
                    style={styles.approveBtn}
                    disabled={loading}
                  >
                    <CheckCircle2 style={{ width: 15, height: 15 }} /> Approve Request
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowRejectForm(false)}
                    style={styles.cancelBtn}
                  >
                    Back
                  </button>
                  <button
                    onClick={() => onReject(request, rejectionReason)}
                    style={styles.confirmRejectBtn}
                    disabled={loading || !rejectionReason.trim()}
                  >
                    Confirm Rejection
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(15, 23, 42, 0.5)',
    backdropFilter: 'blur(4px)',
    zIndex: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    background: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 580,
    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748B',
    background: '#F8FAFC',
  },
  body: {
    padding: '20px 24px',
    overflowY: 'auto',
    maxHeight: '70vh',
  },
  applicantCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '14px',
    background: '#F8FAFC',
    borderRadius: 14,
    border: '1px solid #F1F5F9',
    marginBottom: 20,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 99,
    background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applicantDetails: {
    flex: 1,
  },
  applicantName: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0F172A',
  },
  applicantLocation: {
    fontSize: 12,
    color: '#64748B',
  },
  statusTag: {
    fontSize: 11,
    fontWeight: 800,
    borderRadius: 99,
    padding: '4px 10px',
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    color: '#94A3B8',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  verificationGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  verifyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
  },
  verifyContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  verifyLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#0F172A',
  },
  verifyValue: {
    fontSize: 10.5,
    color: '#64748B',
  },
  checkBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontSize: 10,
    fontWeight: 700,
    color: '#15803D',
    background: '#DCFCE7',
    padding: '2px 6px',
    borderRadius: 6,
  },
  docBox: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  docRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
  },
  docLink: {
    fontSize: 12,
    fontWeight: 700,
    color: '#2563EB',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  inputLabel: {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: '#0F172A',
    marginBottom: 6,
  },
  textInput: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid #CBD5E1',
    outline: 'none',
    fontSize: 13,
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#F8FAFC',
  },
  cancelBtn: {
    padding: '9px 16px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    color: '#64748B',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
  },
  approveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 18px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    color: '#FFFFFF',
    background: '#2563EB',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
  },
  rejectBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 16px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    color: '#EF4444',
    background: '#FEE2E2',
    border: '1px solid #FCA5A5',
  },
  confirmRejectBtn: {
    padding: '9px 18px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    color: '#FFFFFF',
    background: '#EF4444',
  },
}
