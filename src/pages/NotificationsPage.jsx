import { useState } from 'react'
import { useNotifications } from '../hooks/useNotifications'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  AlertTriangle,
  Building2,
  ShieldCheck,
  FileText,
  CheckCircle2,
  XCircle,
  CheckCheck,
  Filter,
  Loader2,
} from 'lucide-react'

const ICON_MAP = {
  'file-check-2': FileText,
  'check-circle-2': CheckCircle2,
  'x-circle': XCircle,
  'alert-triangle': AlertTriangle,
  'building-2': Building2,
  'shield-check': ShieldCheck,
  bell: Bell,
}

const TYPE_STYLES = {
  admin_request: { color: '#B45309', bg: '#FEF3C7', icon: FileText },
  approval: { color: '#15803D', bg: '#DCFCE7', icon: CheckCircle2 },
  rejection: { color: '#B91C1C', bg: '#FEE2E2', icon: XCircle },
  system: { color: '#2563EB', bg: '#EFF6FF', icon: Bell },
  alert: { color: '#B91C1C', bg: '#FEE2E2', icon: AlertTriangle },
}

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markAsRead, markAllRead } = useNotifications()
  const navigate = useNavigate()
  const [filterType, setFilterType] = useState('all')

  const filtered = filterType === 'all'
    ? notifications
    : filterType === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications.filter(n => n.type === filterType)

  function handleNotifClick(notif) {
    markAsRead(notif.id)
    if (notif.link_path) {
      navigate(notif.link_path)
    }
  }

  function getTimeAgo(dateStr) {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Notification Center</h1>
          <p style={styles.pageSubtitle}>
            Real-time system notifications, admin request updates & platform alerts
            {unreadCount > 0 && (
              <span style={styles.unreadBadge}>{unreadCount} unread</span>
            )}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={styles.markAllBtn} className="btn-interactive">
            <CheckCheck style={{ width: 14, height: 14 }} /> Mark All as Read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div style={styles.filterBar}>
        <Filter style={{ width: 14, height: 14, color: '#94A3B8' }} />
        {[
          { key: 'all', label: 'All' },
          { key: 'unread', label: `Unread (${unreadCount})` },
          { key: 'admin_request', label: 'Admin Requests' },
          { key: 'approval', label: 'Approvals' },
          { key: 'rejection', label: 'Rejections' },
          { key: 'system', label: 'System' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterType(tab.key)}
            style={{
              ...styles.filterBtn,
              ...(filterType === tab.key ? styles.filterBtnActive : {}),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {loading ? (
        <div style={styles.loadingBox}>
          <Loader2 style={{ width: 20, height: 20, color: '#2563EB', animation: 'spin 1s linear infinite' }} />
          <span>Loading notifications...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={styles.emptyBox}>
          <Bell style={{ width: 32, height: 32, color: '#CBD5E1' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: '#94A3B8', marginTop: 12 }}>
            {filterType === 'unread' ? 'No unread notifications' : 'No notifications found'}
          </p>
        </div>
      ) : (
        <div style={styles.list}>
          {filtered.map((n) => {
            const typeStyle = TYPE_STYLES[n.type] || TYPE_STYLES.system
            const IconComponent = ICON_MAP[n.icon] || typeStyle.icon

            return (
              <div
                key={n.id}
                style={{
                  ...styles.card,
                  background: n.is_read ? '#FFFFFF' : '#FAFBFF',
                  borderLeft: n.is_read ? '3px solid transparent' : `3px solid ${typeStyle.color}`,
                }}
                onClick={() => handleNotifClick(n)}
              >
                <div style={{ ...styles.iconBox, background: typeStyle.bg, color: typeStyle.color }}>
                  <IconComponent style={{ width: 18, height: 18 }} />
                </div>
                <div style={styles.content}>
                  <div style={styles.titleRow}>
                    <h4 style={{
                      ...styles.title,
                      fontWeight: n.is_read ? 600 : 700,
                    }}>
                      {n.title}
                    </h4>
                    <div style={styles.rightMeta}>
                      {!n.is_read && <span style={styles.unreadDot} />}
                      <span style={styles.time}>{getTimeAgo(n.created_at)}</span>
                    </div>
                  </div>
                  <p style={styles.desc}>{n.message}</p>
                  <div style={styles.metaRow}>
                    <span style={{
                      ...styles.typeBadge,
                      background: typeStyle.bg,
                      color: typeStyle.color,
                    }}>
                      {n.type?.replace(/_/g, ' ')}
                    </span>
                    <span style={styles.fullTime}>
                      {n.created_at ? new Date(n.created_at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }) : ''}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: 20 },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  pageTitle: { fontSize: 22, fontWeight: 800, color: '#0F172A' },
  pageSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 },
  unreadBadge: {
    fontSize: 10.5, fontWeight: 800, color: '#FFFFFF', background: '#EF4444',
    borderRadius: 99, padding: '2px 8px',
  },
  markAllBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 10, fontSize: 12.5, fontWeight: 700,
    color: '#2563EB', background: '#EFF6FF', border: '1px solid #DBEAFE',
  },
  filterBar: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#FFFFFF', padding: '6px 10px', borderRadius: 12,
    border: '1px solid #E2E8F0',
  },
  filterBtn: {
    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    color: '#64748B', background: 'none', border: 'none', cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  filterBtnActive: {
    background: '#2563EB', color: '#FFFFFF',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: {
    border: '1px solid #E2E8F0', borderRadius: 16,
    padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14,
    boxShadow: '0 1px 3px rgba(15,23,42,0.04)', cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  content: { flex: 1 },
  titleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 14, color: '#0F172A' },
  rightMeta: { display: 'flex', alignItems: 'center', gap: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 99, background: '#2563EB' },
  time: { fontSize: 11, fontFamily: 'var(--font-mono)', color: '#94A3B8' },
  desc: { fontSize: 12.5, color: '#64748B', marginTop: 4, lineHeight: 1.4 },
  metaRow: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 },
  typeBadge: { fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px', textTransform: 'capitalize' },
  fullTime: { fontSize: 10.5, color: '#CBD5E1', fontFamily: 'var(--font-mono)' },
  loadingBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 60, fontSize: 13, color: '#64748B' },
  emptyBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80 },
}
