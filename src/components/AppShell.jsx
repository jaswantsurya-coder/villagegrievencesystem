import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { useAdminRequests } from '../hooks/useAdminRequests'
import { initializeSuperAdminFCM } from '../lib/fcmRegistration'
import QuickActions from './QuickActions'
import {
  LayoutDashboard,
  FileCheck2,
  Building2,
  Users,
  ShieldCheck,
  AlertCircle,
  BarChart3,
  Sparkles,
  HelpCircle,
  Bell,
  Settings,
  History,
  Search,
  LogOut,
  Menu,
  X,
  Calendar,
  CheckCheck,
} from 'lucide-react'

export default function AppShell() {
  const { signOut, session, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications()
  const { stats: requestStats } = useAdminRequests('all')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentDateTime, setCurrentDateTime] = useState('')
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const [fcmToast, setFcmToast] = useState(null)
  const notifRef = useRef(null)

  // Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      const formatted =
        now.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          weekday: 'long',
        }) +
        ', ' +
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })
      setCurrentDateTime(formatted)
    }
    updateClock()
    const clockInterval = setInterval(updateClock, 10000)
    return () => clearInterval(clockInterval)
  }, [])

  // Initialize FCM on login
  useEffect(() => {
    if (user?.id) {
      initializeSuperAdminFCM(user.id, (notif) => {
        setFcmToast(notif)
        setTimeout(() => setFcmToast(null), 6000)
      }).catch(() => {})
    }
  }, [user?.id])

  // Close notification dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const pendingCount = requestStats.pending

  const NAV_ITEMS = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/approvals', label: 'Admin Requests', icon: FileCheck2, badge: pendingCount, badgeColor: '#2563EB' },
    { to: '/villages', label: 'Villages', icon: Building2 },
    { to: '/citizens', label: 'Citizens', icon: Users },
    { to: '/officers', label: 'Officers', icon: ShieldCheck },
    { to: '/complaints', label: 'Complaints', icon: AlertCircle },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/ai-insights', label: 'AI Insights', icon: Sparkles, tag: 'Soon' },
    { to: '/help-desk', label: 'Help Desk', icon: HelpCircle, badge: 5, badgeColor: '#3B82F6' },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/audit-logs', label: 'Audit Logs', icon: History },
  ]

  return (
    <div style={styles.appContainer}>
      {/* SIDEBAR */}
      <aside style={{ ...styles.sidebar, width: sidebarOpen ? 260 : 78 }}>
        {/* Top Logo Header */}
        <div style={styles.logoSection} onClick={() => navigate('/')}>
          <div style={styles.logoBox}>
            <Building2 style={{ width: 22, height: 22, color: '#2563EB' }} />
          </div>
          {sidebarOpen && (
            <div style={styles.logoTextGroup}>
              <span style={styles.logoTitle}>GramSeva</span>
              <span style={styles.logoBadge}>SUPER ADMIN PORTAL</span>
            </div>
          )}
        </div>

        <div style={styles.navSectionLabel}>{sidebarOpen ? 'MAIN NAVIGATION' : '•'}</div>

        {/* Navigation Item List */}
        <div style={styles.navList}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.to

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                style={{
                  ...styles.navItem,
                  ...(isActive ? styles.navItemActive : {}),
                }}
              >
                <Icon style={{ ...styles.navIcon, color: isActive ? '#FFFFFF' : '#64748B' }} />
                {sidebarOpen && <span style={styles.navLabel}>{item.label}</span>}
                {sidebarOpen && item.badge > 0 && (
                  <span style={{ ...styles.badge, background: isActive ? '#FFFFFF' : item.badgeColor, color: isActive ? '#2563EB' : '#FFFFFF' }}>
                    {item.badge}
                  </span>
                )}
                {sidebarOpen && item.tag && (
                  <span style={styles.tag}>{item.tag}</span>
                )}
              </NavLink>
            )
          })}
        </div>

        {/* User Profile Footer */}
        <div style={styles.userSection}>
          {sidebarOpen ? (
            <div style={styles.userInfoCard}>
              <div style={styles.avatar}>SA</div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={styles.userName}>Super Admin</div>
                <div style={styles.userEmail}>{session?.user?.email || 'superadmin@gramseva.in'}</div>
                <div style={styles.onlineStatus}>
                  <span style={styles.greenDot} className="pulse-dot" /> Online
                </div>
              </div>
            </div>
          ) : (
            <div style={{ ...styles.avatar, margin: '0 auto' }}>SA</div>
          )}

          <button onClick={signOut} style={styles.logoutBtn} title="Sign Out">
            <LogOut style={{ width: 16, height: 16 }} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* MAIN WRAPPER */}
      <div style={styles.mainWrapper}>
        {/* TOP HEADER BAR */}
        <header style={styles.topHeader}>
          <div style={styles.headerLeft}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={styles.iconBtn} title="Toggle Menu">
              {sidebarOpen ? <X style={{ width: 18, height: 18 }} /> : <Menu style={{ width: 18, height: 18 }} />}
            </button>

            {/* Search Bar */}
            <div style={styles.searchContainer}>
              <Search style={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search villages, complaints, users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
              <span style={styles.searchShortcut}>/</span>
            </div>
          </div>

          <div style={styles.headerRight}>
            {/* Notification Bell with Dropdown */}
            <div style={{ position: 'relative' }} ref={notifRef}>
              <div
                style={styles.notificationWrapper}
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                title="Notifications"
              >
                <Bell style={{ width: 18, height: 18, color: '#475569' }} />
                {unreadCount > 0 && (
                  <span style={styles.notificationBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </div>

              {/* Notification Dropdown */}
              {showNotifDropdown && (
                <div style={styles.notifDropdown}>
                  <div style={styles.notifDropdownHeader}>
                    <span style={styles.notifDropdownTitle}>Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markAllRead() }}
                        style={styles.markAllReadBtn}
                      >
                        <CheckCheck style={{ width: 12, height: 12 }} /> Mark all read
                      </button>
                    )}
                  </div>
                  <div style={styles.notifDropdownList}>
                    {notifications.slice(0, 5).map(n => (
                      <div
                        key={n.id}
                        style={{
                          ...styles.notifDropdownItem,
                          background: n.is_read ? '#FFFFFF' : '#EFF6FF',
                          borderLeft: n.is_read ? '3px solid transparent' : '3px solid #2563EB',
                        }}
                        onClick={() => {
                          markAsRead(n.id)
                          setShowNotifDropdown(false)
                          navigate(n.link_path || '/notifications')
                        }}
                      >
                        <div style={styles.notifItemTitle}>{n.title}</div>
                        <div style={styles.notifItemMsg}>{n.message}</div>
                        <div style={styles.notifItemTime}>
                          {n.created_at ? new Date(n.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                        </div>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 12.5 }}>No notifications yet</div>
                    )}
                  </div>
                  <div style={styles.notifDropdownFooter}>
                    <button
                      onClick={() => { setShowNotifDropdown(false); navigate('/notifications') }}
                      style={styles.viewAllNotifsBtn}
                    >
                      View All Notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Date Display */}
            <div style={styles.dateDisplay}>
              <Calendar style={{ width: 14, height: 14, color: '#64748B' }} />
              <span style={styles.dateText}>{currentDateTime || '17 May 2025 Saturday, 09:41 AM'}</span>
            </div>

            {/* User Avatar */}
            <div style={styles.headerAvatar} onClick={() => navigate('/settings')} title="Settings">
              SA
            </div>
          </div>

          {/* FCM Toast */}
          {fcmToast && (
            <div style={styles.fcmToast}>
              <Bell style={{ width: 14, height: 14, color: '#2563EB' }} />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>{fcmToast.title}</div>
                <div style={{ fontSize: 11.5, color: '#64748B' }}>{fcmToast.body}</div>
              </div>
              <button onClick={() => setFcmToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X style={{ width: 12, height: 12, color: '#94A3B8' }} />
              </button>
            </div>
          )}
        </header>

        {/* MAIN PAGE BODY */}
        <main style={styles.contentBody}>
          <Outlet context={{ searchQuery }} />
        </main>

        {/* FLOATING QUICK ACTIONS */}
        <QuickActions />
      </div>
    </div>
  )
}

const styles = {
  appContainer: {
    display: 'flex',
    minHeight: '100vh',
    background: '#F8FAFC',
    color: '#0F172A',
  },
  sidebar: {
    background: '#FFFFFF',
    borderRight: '1px solid #E2E8F0',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 14px',
    transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    flexShrink: 0,
    zIndex: 20,
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    paddingLeft: 4,
    cursor: 'pointer',
  },
  logoBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: '#EFF6FF',
    border: '1px solid #DBEAFE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoTextGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  logoTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#2563EB',
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  logoBadge: {
    fontSize: 9,
    fontWeight: 800,
    color: '#3B82F6',
    letterSpacing: '0.08em',
    marginTop: 2,
  },
  navSectionLabel: {
    fontSize: 10,
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    color: '#94A3B8',
    letterSpacing: '0.12em',
    marginBottom: 10,
    paddingLeft: 8,
  },
  navList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    flex: 1,
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 12,
    color: '#475569',
    fontSize: 13.5,
    fontWeight: 500,
    transition: 'all 0.15s ease',
  },
  navItemActive: {
    background: '#2563EB',
    color: '#FFFFFF',
    fontWeight: 700,
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
  },
  navIcon: {
    width: 18,
    height: 18,
    flexShrink: 0,
  },
  navLabel: {
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  badge: {
    fontSize: 11,
    fontWeight: 800,
    borderRadius: 99,
    padding: '2px 8px',
    lineHeight: 1,
  },
  tag: {
    background: '#DBEAFE',
    color: '#1D4ED8',
    fontSize: 10,
    fontWeight: 800,
    borderRadius: 6,
    padding: '2px 6px',
    textTransform: 'uppercase',
  },
  userSection: {
    marginTop: 'auto',
    paddingTop: 16,
    borderTop: '1px solid #F1F5F9',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  userInfoCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 12,
    background: '#F8FAFC',
    border: '1px solid #F1F5F9',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 99,
    background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)',
    color: '#FFFFFF',
    fontWeight: 800,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userName: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0F172A',
    lineHeight: 1.2,
  },
  userEmail: {
    fontSize: 11,
    color: '#64748B',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  onlineStatus: {
    fontSize: 10,
    color: '#166534',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    background: '#22C55E',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 12px',
    borderRadius: 10,
    color: '#64748B',
    fontSize: 13,
    fontWeight: 600,
    background: 'none',
    width: '100%',
    transition: 'all 0.15s ease',
  },
  mainWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    position: 'relative',
  },
  topHeader: {
    height: 68,
    background: '#FFFFFF',
    borderBottom: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 28px',
    gap: 16,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    maxWidth: 520,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#475569',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
  },
  searchContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 12,
    padding: '0 14px',
    height: 42,
    width: '100%',
  },
  searchIcon: {
    width: 16,
    height: 16,
    color: '#94A3B8',
  },
  searchInput: {
    border: 'none',
    background: 'none',
    outline: 'none',
    fontSize: 13,
    color: '#0F172A',
    width: '100%',
  },
  searchShortcut: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    color: '#64748B',
    borderRadius: 4,
    padding: '1px 6px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  notificationWrapper: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 10,
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    background: '#EF4444',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 800,
    borderRadius: 99,
    padding: '2px 6px',
    border: '2px solid #FFFFFF',
  },
  dateDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
  },
  dateText: {
    fontSize: 12,
    fontWeight: 600,
    color: '#475569',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 99,
    background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)',
    color: '#FFFFFF',
    fontWeight: 800,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)',
  },
  contentBody: {
    flex: 1,
    padding: '28px 32px 60px',
    overflowY: 'auto',
  },
  // Notification Dropdown Styles
  notifDropdown: {
    position: 'absolute',
    top: 48,
    right: 0,
    width: 380,
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 16,
    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.15)',
    zIndex: 100,
    overflow: 'hidden',
  },
  notifDropdownHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid #F1F5F9',
  },
  notifDropdownTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: '#0F172A',
  },
  markAllReadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 600,
    color: '#2563EB',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  notifDropdownList: {
    maxHeight: 320,
    overflowY: 'auto',
  },
  notifDropdownItem: {
    padding: '12px 18px',
    borderBottom: '1px solid #F8FAFC',
    cursor: 'pointer',
    transition: 'background 0.1s ease',
  },
  notifItemTitle: {
    fontSize: 12.5,
    fontWeight: 700,
    color: '#0F172A',
    lineHeight: 1.3,
  },
  notifItemMsg: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 1.4,
  },
  notifItemTime: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: 'var(--font-mono)',
    marginTop: 4,
  },
  notifDropdownFooter: {
    padding: '10px 18px',
    borderTop: '1px solid #F1F5F9',
    textAlign: 'center',
  },
  viewAllNotifsBtn: {
    fontSize: 12,
    fontWeight: 700,
    color: '#2563EB',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  fcmToast: {
    position: 'fixed',
    top: 80,
    right: 32,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 18px',
    background: '#FFFFFF',
    border: '1px solid #DBEAFE',
    borderRadius: 14,
    boxShadow: '0 8px 24px rgba(37, 99, 235, 0.15)',
    zIndex: 200,
    animation: 'slideInRight 0.3s ease',
  },
}
