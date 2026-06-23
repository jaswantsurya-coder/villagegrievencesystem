import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: '⌂' },
  { to: '/approvals', label: 'Approvals', icon: '✓' },
  { to: '/villages', label: 'Villages', icon: '⌖' },
  { to: '/analytics', label: 'Analytics', icon: '◫' },
]

export default function AppShell() {
  const { signOut } = useAuth()

  return (
    <div style={styles.shell}>
      <nav style={styles.rail}>
        <div style={styles.brand}>
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="19" stroke="#C9601E" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="13" stroke="#C9601E" strokeWidth="1" />
            <text x="20" y="25" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fill="#C9601E">GS</text>
          </svg>
        </div>

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
            </NavLink>
          ))}
        </div>

        <button onClick={signOut} style={styles.signOut}>
          Sign out
        </button>
      </nav>

      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

const styles = {
  shell: { display: 'flex', minHeight: '100vh', background: 'var(--bg)' },
  rail: {
    width: 88,
    flexShrink: 0,
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px 0',
  },
  brand: { marginBottom: 32 },
  navList: { display: 'flex', flexDirection: 'column', gap: 6, width: '100%', alignItems: 'center' },
  navItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    width: 68,
    padding: '10px 4px',
    borderRadius: 4,
    color: 'var(--stone)',
    fontSize: 10.5,
    fontWeight: 500,
  },
  navItemActive: {
    background: 'var(--surface)',
    color: 'var(--parchment)',
  },
  navIcon: { fontSize: 16 },
  navLabel: { letterSpacing: '0.01em' },
  signOut: {
    marginTop: 'auto',
    background: 'none',
    border: 'none',
    color: 'var(--stone-dim)',
    fontSize: 10.5,
    cursor: 'pointer',
    padding: '8px 4px',
  },
  main: { flex: 1, padding: '32px 40px', maxWidth: 1240 },
}
