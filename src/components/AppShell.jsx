import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function AppShell() {
  const { signOut, session } = useAuth()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    fetchPendingCount()
    const interval = setInterval(fetchPendingCount, 10000)
    return () => clearInterval(interval)
  }, [])

  async function fetchPendingCount() {
    try {
      const { count, error } = await supabase
        .from('admin_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      if (!error && count !== null) {
        setPendingCount(count)
      }
    } catch {
      // Ignore count fetch errors
    }
  }

  const NAV_ITEMS = [
    { to: '/', label: 'Overview', icon: '⌂' },
    { to: '/approvals', label: 'Admin Approvals', icon: '✓', badge: pendingCount },
    { to: '/villages', label: 'Villages', icon: '⌖' },
    { to: '/analytics', label: 'Analytics', icon: '◫' },
  ]

  return (
    <div style={styles.shell}>
      <nav style={styles.sidebar}>
        <div style={styles.brandContainer}>
          <div style={styles.brandLogo}>
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="19" stroke="#C9601E" strokeWidth="2" />
              <circle cx="20" cy="20" r="12" stroke="#C9601E" strokeWidth="1.2" />
              <text x="20" y="25" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="12" fontWeight="bold" fill="#C9601E">GS</text>
            </svg>
          </div>
          <div>
            <div style={styles.brandTitle}>GramSeva</div>
            <div style={styles.brandSubtitle}>SuperAdmin Portal</div>
          </div>
        </div>

        <div style={styles.navSectionLabel}>NAVIGATION</div>

        <div style={styles.navList}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              })}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              <span style={styles.navLabel}>{item.label}</span>
              {item.badge > 0 && (
                <span style={styles.badge}>{item.badge}</span>
              )}
            </NavLink>
          ))}
        </div>

        <div style={styles.userSection}>
          <div style={styles.userInfo}>
            <span style={styles.userEmail}>{session?.user?.email || 'Superadmin'}</span>
            <span style={styles.userRole}>Super Admin</span>
          </div>
          <button onClick={signOut} style={styles.signOutBtn}>
            Sign Out
          </button>
        </div>
      </nav>

      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

const styles = {
  shell: { display: 'flex', minHeight: '100vh', background: 'var(--bg)' },
  sidebar: {
    width: 240,
    flexShrink: 0,
    borderRight: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
  },
  brandContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
    paddingBottom: 16,
    borderBottom: '1px solid var(--border)',
  },
  brandLogo: { flexShrink: 0 },
  brandTitle: { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--parchment)' },
  brandSubtitle: { fontSize: 11, color: 'var(--terracotta)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  navSectionLabel: {
    fontSize: 10,
    fontFamily: 'var(--font-mono)',
    color: 'var(--stone-dim)',
    letterSpacing: '0.12em',
    marginBottom: 8,
    paddingLeft: 8,
  },
  navList: { display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    color: 'var(--stone)',
    fontSize: 13.5,
    fontWeight: 500,
    transition: 'all 0.15s ease',
  },
  navItemActive: {
    background: 'var(--surface-raised)',
    color: 'var(--parchment)',
    fontWeight: 600,
    borderLeft: '3px solid var(--terracotta)',
  },
  navIcon: { fontSize: 16, width: 20, textAlign: 'center' },
  navLabel: { flex: 1 },
  badge: {
    background: 'var(--terracotta)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 12,
    padding: '2px 8px',
    lineHeight: 1,
  },
  userSection: {
    marginTop: 'auto',
    paddingTop: 16,
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  userInfo: { display: 'flex', flexDirection: 'column', paddingLeft: 4 },
  userEmail: { fontSize: 12, color: 'var(--parchment)', fontWeight: 500, truncate: true },
  userRole: { fontSize: 10, color: 'var(--stone)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' },
  signOutBtn: {
    background: 'rgba(201, 96, 30, 0.15)',
    border: '1px solid rgba(201, 96, 30, 0.3)',
    color: 'var(--terracotta)',
    padding: '8px 12px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
  },
  main: { flex: 1, padding: '32px 40px', maxWidth: 1240, overflowY: 'auto' },
}
