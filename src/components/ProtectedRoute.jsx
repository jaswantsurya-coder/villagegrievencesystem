import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children }) {
  const { session, isSuperAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--stone)' }}>
        Checking access…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!isSuperAdmin) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: 'var(--parchment)',
        textAlign: 'center',
        padding: 24,
      }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: 0 }}>Access restricted</h2>
        <p style={{ color: 'var(--stone)', fontSize: 13.5, maxWidth: 380, margin: 0 }}>
          This portal is limited to super admin accounts. Your account does not currently have super admin access.
        </p>
      </div>
    )
  }

  return children
}
