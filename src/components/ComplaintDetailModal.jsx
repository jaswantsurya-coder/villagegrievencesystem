import { X, Trash2, MapPin, User, Phone, Calendar, Tag, AlertTriangle, MessageSquare, Image, CheckCircle2, Clock, Shield } from 'lucide-react'

/**
 * Complaint Detail Modal — shows full details of a single complaint.
 * Includes citizen info, village, category, description, attachments, timeline.
 */
export default function ComplaintDetailModal({ complaint, citizen, village, onClose, onDelete }) {
  if (!complaint) return null

  function formatDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const statusConfig = {
    'Resolved': { color: '#15803D', bg: '#DCFCE7', icon: CheckCircle2 },
    'In Progress': { color: '#B45309', bg: '#FEF3C7', icon: Clock },
    'Open': { color: '#1D4ED8', bg: '#EFF6FF', icon: AlertTriangle },
    'Submitted': { color: '#1D4ED8', bg: '#EFF6FF', icon: AlertTriangle },
    'Pending': { color: '#6B21A8', bg: '#F3E8FF', icon: Clock },
  }

  const sc = statusConfig[complaint.status] || statusConfig['Open']
  const StatusIcon = sc.icon

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>
              Complaint Details
            </h2>
            <p style={styles.ticketId}>
              {complaint.ticket_number || (typeof complaint.id === 'string' ? complaint.id.slice(0, 8) : `TKT-${complaint.id}`)}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onDelete && (
              <button onClick={() => onDelete(complaint)} style={styles.deleteBtn}>
                <Trash2 style={{ width: 15, height: 15 }} /> Delete
              </button>
            )}
            <button onClick={onClose} style={styles.closeBtn}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>

        <div style={styles.body}>
          {/* Status + Priority Row */}
          <div style={styles.statusRow}>
            <div style={{ ...styles.statusBadge, background: sc.bg, color: sc.color }}>
              <StatusIcon style={{ width: 14, height: 14 }} />
              {complaint.is_escalated ? 'Escalated' : complaint.status || 'Open'}
            </div>
            {complaint.priority && (
              <div style={{
                ...styles.priorityBadge,
                color: complaint.priority === 'High' || complaint.priority === 'Critical' ? '#B91C1C' : complaint.priority === 'Medium' ? '#B45309' : '#15803D',
                background: complaint.priority === 'High' || complaint.priority === 'Critical' ? '#FEE2E2' : complaint.priority === 'Medium' ? '#FEF3C7' : '#DCFCE7',
              }}>
                {complaint.priority} Priority
              </div>
            )}
            {complaint.is_escalated && (
              <div style={{ ...styles.escalatedBadge }}>
                <AlertTriangle style={{ width: 12, height: 12 }} /> Escalated
              </div>
            )}
          </div>

          {/* Title / Subject */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <MessageSquare style={{ width: 14, height: 14, color: '#2563EB' }} />
              Subject
            </h3>
            <p style={styles.complaintTitle}>{complaint.title || complaint.description || 'General Grievance'}</p>
          </div>

          {/* Description */}
          {complaint.description && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                <MessageSquare style={{ width: 14, height: 14, color: '#64748B' }} />
                Description
              </h3>
              <p style={styles.description}>{complaint.description}</p>
            </div>
          )}

          {/* Two-Column: Citizen Info + Location */}
          <div style={styles.twoCol}>
            {/* Citizen Info */}
            <div style={styles.infoCard}>
              <h3 style={styles.sectionTitle}>
                <User style={{ width: 14, height: 14, color: '#2563EB' }} />
                Filed By
              </h3>
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Name</span>
                  <span style={styles.infoValue}>{citizen?.name || 'Anonymous'}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Phone</span>
                  <span style={styles.infoValue}>{citizen?.phone || '—'}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Role</span>
                  <span style={styles.infoValue}>{citizen?.role || '—'}</span>
                </div>
              </div>
            </div>

            {/* Location */}
            <div style={styles.infoCard}>
              <h3 style={styles.sectionTitle}>
                <MapPin style={{ width: 14, height: 14, color: '#DC2626' }} />
                Location
              </h3>
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Village</span>
                  <span style={styles.infoValue}>{village?.village_name || '—'}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>District</span>
                  <span style={styles.infoValue}>{village?.district || '—'}</span>
                </div>
                {complaint.location && (
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>Locality</span>
                    <span style={styles.infoValue}>{complaint.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Category + Dates */}
          <div style={styles.twoCol}>
            <div style={styles.infoCard}>
              <h3 style={styles.sectionTitle}>
                <Tag style={{ width: 14, height: 14, color: '#7C3AED' }} />
                Category & Type
              </h3>
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Category</span>
                  <span style={styles.infoValue}>{complaint.category || 'General'}</span>
                </div>
                {complaint.sub_category && (
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>Sub-Category</span>
                    <span style={styles.infoValue}>{complaint.sub_category}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={styles.infoCard}>
              <h3 style={styles.sectionTitle}>
                <Calendar style={{ width: 14, height: 14, color: '#0891B2' }} />
                Timeline
              </h3>
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Filed On</span>
                  <span style={styles.infoValue}>{formatDate(complaint.created_at)}</span>
                </div>
                {complaint.updated_at && (
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>Last Updated</span>
                    <span style={styles.infoValue}>{formatDate(complaint.updated_at)}</span>
                  </div>
                )}
                {complaint.resolved_at && (
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>Resolved On</span>
                    <span style={styles.infoValue}>{formatDate(complaint.resolved_at)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Assigned Officer */}
          {complaint.assigned_to && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                <Shield style={{ width: 14, height: 14, color: '#0F766E' }} />
                Assigned Officer
              </h3>
              <p style={styles.infoValue}>{complaint.assigned_to}</p>
            </div>
          )}

          {/* Attachments / Images */}
          {(complaint.image_url || complaint.attachment_url || complaint.photo_url) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                <Image style={{ width: 14, height: 14, color: '#D97706' }} />
                Attachments
              </h3>
              <div style={styles.attachmentGrid}>
                {[complaint.image_url, complaint.attachment_url, complaint.photo_url].filter(Boolean).map((url, idx) => (
                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer" style={styles.attachmentLink}>
                    <img src={url} alt={`Attachment ${idx + 1}`} style={styles.attachmentImg} onError={(e) => { e.target.style.display = 'none' }} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Resolution Notes */}
          {complaint.resolution_notes && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                <CheckCircle2 style={{ width: 14, height: 14, color: '#15803D' }} />
                Resolution Notes
              </h3>
              <p style={styles.description}>{complaint.resolution_notes}</p>
            </div>
          )}

          {/* Feedback */}
          {complaint.feedback && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                <MessageSquare style={{ width: 14, height: 14, color: '#7C3AED' }} />
                Citizen Feedback
              </h3>
              <p style={styles.description}>{complaint.feedback}</p>
              {complaint.rating && (
                <div style={{ marginTop: 6, fontSize: 13, color: '#D97706', fontWeight: 700 }}>
                  Rating: {'★'.repeat(complaint.rating)}{'☆'.repeat(5 - complaint.rating)}
                </div>
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
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, backdropFilter: 'blur(4px)',
  },
  modal: {
    background: '#FFFFFF', borderRadius: 20, width: '90%', maxWidth: 720,
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 25px 60px rgba(15,23,42,0.20)',
    border: '1px solid #E2E8F0',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px', borderBottom: '1px solid #E2E8F0',
  },
  title: { fontSize: 18, fontWeight: 800, color: '#0F172A' },
  ticketId: { fontSize: 12, fontFamily: 'var(--font-mono)', color: '#64748B', marginTop: 2 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 10, border: '1px solid #E2E8F0',
    background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#64748B', cursor: 'pointer',
  },
  deleteBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
    color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA',
    cursor: 'pointer',
  },
  body: {
    padding: '20px 24px', overflowY: 'auto', display: 'flex',
    flexDirection: 'column', gap: 18,
  },
  statusRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 12, fontWeight: 700, borderRadius: 99, padding: '4px 14px',
  },
  priorityBadge: { fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 6 },
  escalatedBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 11, fontWeight: 800, color: '#B91C1C', background: '#FEE2E2',
    padding: '3px 10px', borderRadius: 6,
  },
  section: {},
  sectionTitle: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase',
    letterSpacing: '0.04em', marginBottom: 8,
  },
  complaintTitle: { fontSize: 16, fontWeight: 700, color: '#0F172A', lineHeight: 1.4 },
  description: { fontSize: 13.5, color: '#334155', lineHeight: 1.6, background: '#F8FAFC', padding: '12px 16px', borderRadius: 12, border: '1px solid #F1F5F9' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  infoCard: {
    background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: 14, padding: 16,
  },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  infoItem: { display: 'flex', flexDirection: 'column', gap: 2 },
  infoLabel: { fontSize: 10.5, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' },
  infoValue: { fontSize: 13, fontWeight: 600, color: '#0F172A' },
  attachmentGrid: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  attachmentLink: { display: 'block', borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0' },
  attachmentImg: { width: 140, height: 100, objectFit: 'cover', display: 'block' },
}
