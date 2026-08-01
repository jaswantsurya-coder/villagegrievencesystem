import { useState } from 'react'
import { X, CheckCircle2, XCircle, FileText, ShieldCheck, Mail, Phone, ExternalLink, User, MapPin, Hash, Camera } from 'lucide-react'

export default function AdminRequestModal({ request, onClose, onApprove, onReject, loading }) {
  const [reviewerNotes, setReviewerNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  if (!request) return null

  const initials = (request.full_name || 'A').split(' ').map(n => n[0]).join('').toUpperCase()

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
              <p style={styles.modalSubtitle}>
                Request ID: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#2563EB' }}>
                  {request.request_id || `#${request.id?.slice(0, 8)}`}
                </span>
              </p>
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
            {request.profile_photo_url ? (
              <img src={request.profile_photo_url} alt="Profile" style={styles.profilePhoto} />
            ) : (
              <div style={styles.avatar}>{initials}</div>
            )}
            <div style={styles.applicantDetails}>
              <h4 style={styles.applicantName}>{request.full_name || 'Sarpanch Applicant'}</h4>
              <p style={styles.applicantLocation}>
                {request.village_name}, {request.district}, {request.state || 'Andhra Pradesh'}
              </p>
              {request.mandal && (
                <p style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>Mandal: {request.mandal}</p>
              )}
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

          {/* Personal Information Grid */}
          <div style={styles.sectionTitle}>Personal Information</div>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <User style={{ width: 14, height: 14, color: '#2563EB' }} />
              <div style={styles.infoContent}>
                <span style={styles.infoLabel}>Full Name</span>
                <span style={styles.infoValue}>{request.full_name || '—'}</span>
              </div>
            </div>
            <div style={styles.infoItem}>
              <Mail style={{ width: 14, height: 14, color: '#2563EB' }} />
              <div style={styles.infoContent}>
                <span style={styles.infoLabel}>Email</span>
                <span style={styles.infoValue}>{request.email || '—'}</span>
              </div>
            </div>
            <div style={styles.infoItem}>
              <Phone style={{ width: 14, height: 14, color: '#166534' }} />
              <div style={styles.infoContent}>
                <span style={styles.infoLabel}>Phone</span>
                <span style={styles.infoValue}>{request.phone || '—'}</span>
              </div>
            </div>
            <div style={styles.infoItem}>
              <User style={{ width: 14, height: 14, color: '#7C3AED' }} />
              <div style={styles.infoContent}>
                <span style={styles.infoLabel}>Gender</span>
                <span style={styles.infoValue}>{request.gender || '—'}</span>
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div style={{ ...styles.sectionTitle, marginTop: 16 }}>Location Details</div>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <MapPin style={{ width: 14, height: 14, color: '#DC2626' }} />
              <div style={styles.infoContent}>
                <span style={styles.infoLabel}>Village</span>
                <span style={styles.infoValue}>{request.village_name || '—'}</span>
              </div>
            </div>
            <div style={styles.infoItem}>
              <MapPin style={{ width: 14, height: 14, color: '#F59E0B' }} />
              <div style={styles.infoContent}>
                <span style={styles.infoLabel}>Mandal</span>
                <span style={styles.infoValue}>{request.mandal || '—'}</span>
              </div>
            </div>
            <div style={styles.infoItem}>
              <MapPin style={{ width: 14, height: 14, color: '#2563EB' }} />
              <div style={styles.infoContent}>
                <span style={styles.infoLabel}>District</span>
                <span style={styles.infoValue}>{request.district || '—'}</span>
              </div>
            </div>
            <div style={styles.infoItem}>
              <MapPin style={{ width: 14, height: 14, color: '#166534' }} />
              <div style={styles.infoContent}>
                <span style={styles.infoLabel}>State</span>
                <span style={styles.infoValue}>{request.state || 'Andhra Pradesh'}</span>
              </div>
            </div>
          </div>

          {request.address && (
            <div style={{ ...styles.infoItem, marginTop: 8 }}>
              <MapPin style={{ width: 14, height: 14, color: '#64748B' }} />
              <div style={styles.infoContent}>
                <span style={styles.infoLabel}>Full Address</span>
                <span style={styles.infoValue}>{request.address}</span>
              </div>
            </div>
          )}

          {/* Document Verification */}
          <div style={{ ...styles.sectionTitle, marginTop: 16 }}>Verification Documents</div>
          <div style={styles.verificationGrid}>
            <div style={styles.verifyItem}>
              <FileText style={{ width: 15, height: 15, color: '#2563EB' }} />
              <div style={styles.verifyContent}>
                <span style={styles.verifyLabel}>Aadhaar</span>
                <span style={styles.verifyValue}>
                  {request.aadhaar_number ? `XXXX-XXXX-${request.aadhaar_number.slice(-4)}` : 'Not provided'}
                </span>
              </div>
              {request.aadhaar_number && (
                <span style={styles.checkBadge}>
                  <CheckCircle2 style={{ width: 13, height: 13 }} /> Provided
                </span>
              )}
            </div>

            <div style={styles.verifyItem}>
              <FileText style={{ width: 15, height: 15, color: '#2563EB' }} />
              <div style={styles.verifyContent}>
                <span style={styles.verifyLabel}>Government ID</span>
                <span style={styles.verifyValue}>
                  {request.government_id_url ? 'Document Uploaded' : 'Not uploaded'}
                </span>
              </div>
              {request.government_id_url && (
                <a href={request.government_id_url} target="_blank" rel="noreferrer" style={styles.docLink}>
                  View <ExternalLink style={{ width: 11, height: 11 }} />
                </a>
              )}
            </div>

            <div style={styles.verifyItem}>
              <Camera style={{ width: 15, height: 15, color: '#7C3AED' }} />
              <div style={styles.verifyContent}>
                <span style={styles.verifyLabel}>Profile Photo</span>
                <span style={styles.verifyValue}>
                  {request.profile_photo_url ? 'Photo Uploaded' : 'Not uploaded'}
                </span>
              </div>
              {request.profile_photo_url && (
                <a href={request.profile_photo_url} target="_blank" rel="noreferrer" style={styles.docLink}>
                  View <ExternalLink style={{ width: 11, height: 11 }} />
                </a>
              )}
            </div>

            <div style={styles.verifyItem}>
              <Hash style={{ width: 15, height: 15, color: '#D97706' }} />
              <div style={styles.verifyContent}>
                <span style={styles.verifyLabel}>Request ID</span>
                <span style={{ ...styles.verifyValue, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#2563EB' }}>
                  {request.request_id || `#${request.id?.slice(0, 8)}`}
                </span>
              </div>
            </div>
          </div>

          {/* Reason for Becoming Admin */}
          {request.reason && (
            <div style={{ marginTop: 16 }}>
              <div style={styles.sectionTitle}>Reason for Becoming Village Administrator</div>
              <div style={styles.reasonBox}>
                <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, margin: 0 }}>{request.reason}</p>
              </div>
            </div>
          )}

          {/* Invitation URL (if approved) */}
          {request.invitation_url && (
            <div style={{ marginTop: 16 }}>
              <div style={styles.sectionTitle}>Invitation Link</div>
              <div style={styles.invitationBox}>
                <input type="text" readOnly value={request.invitation_url} style={styles.invitationInput} />
                <a href={request.invitation_url} target="_blank" rel="noreferrer" style={styles.docLink}>
                  Open <ExternalLink style={{ width: 11, height: 11 }} />
                </a>
              </div>
            </div>
          )}

          {/* Rejection Reason (if rejected) */}
          {request.status === 'rejected' && request.rejection_reason && (
            <div style={{ marginTop: 16 }}>
              <div style={{ ...styles.sectionTitle, color: '#B91C1C' }}>Rejection Reason</div>
              <div style={{ ...styles.reasonBox, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                <p style={{ fontSize: 13, color: '#991B1B', lineHeight: 1.6, margin: 0 }}>{request.rejection_reason}</p>
              </div>
            </div>
          )}

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
    maxWidth: 640,
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
  headerTitleGroup: { display: 'flex', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 16, fontWeight: 800, color: '#0F172A' },
  modalSubtitle: { fontSize: 11.5, color: '#64748B' },
  closeBtn: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', background: '#F8FAFC' },
  body: { padding: '20px 24px', overflowY: 'auto', maxHeight: '70vh' },
  applicantCard: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px', background: '#F8FAFC', borderRadius: 14,
    border: '1px solid #F1F5F9', marginBottom: 20,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 99,
    background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)',
    color: '#FFFFFF', fontSize: 15, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  profilePhoto: {
    width: 44, height: 44, borderRadius: 99, objectFit: 'cover',
    border: '2px solid #DBEAFE',
  },
  applicantDetails: { flex: 1 },
  applicantName: { fontSize: 15, fontWeight: 800, color: '#0F172A' },
  applicantLocation: { fontSize: 12, color: '#64748B' },
  statusTag: { fontSize: 11, fontWeight: 800, borderRadius: 99, padding: '4px 10px' },
  sectionTitle: {
    fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
    color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10,
  },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  infoItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10,
  },
  infoContent: { flex: 1, display: 'flex', flexDirection: 'column' },
  infoLabel: { fontSize: 10.5, fontWeight: 700, color: '#94A3B8' },
  infoValue: { fontSize: 12.5, fontWeight: 600, color: '#0F172A', marginTop: 1 },
  verificationGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  verifyItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10,
  },
  verifyContent: { flex: 1, display: 'flex', flexDirection: 'column' },
  verifyLabel: { fontSize: 11, fontWeight: 700, color: '#0F172A' },
  verifyValue: { fontSize: 10.5, color: '#64748B' },
  checkBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    fontSize: 10, fontWeight: 700, color: '#15803D',
    background: '#DCFCE7', padding: '2px 6px', borderRadius: 6,
  },
  docLink: {
    fontSize: 11, fontWeight: 700, color: '#2563EB',
    display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none',
  },
  reasonBox: {
    background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12,
    padding: '14px 16px',
  },
  invitationBox: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: 12,
    padding: '10px 14px',
  },
  invitationInput: {
    flex: 1, border: 'none', background: 'none', outline: 'none',
    fontSize: 11.5, fontFamily: 'var(--font-mono)', color: '#166534',
  },
  inputLabel: { display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 6 },
  textInput: {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: '1px solid #CBD5E1', outline: 'none', fontSize: 13,
  },
  footer: {
    padding: '16px 24px', borderTop: '1px solid #E2E8F0',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC',
  },
  cancelBtn: {
    padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
    color: '#64748B', background: '#FFFFFF', border: '1px solid #CBD5E1',
  },
  approveBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
    color: '#FFFFFF', background: '#2563EB', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
  },
  rejectBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
    color: '#EF4444', background: '#FEE2E2', border: '1px solid #FCA5A5',
  },
  confirmRejectBtn: {
    padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
    color: '#FFFFFF', background: '#EF4444',
  },
}
