import { Navigate } from 'react'
import { useAuth } from '../hooks/useAuth'
import { ShieldAlert, LogOut } from 'lucide-react'

export default function ProtectedRoute({ children }) {
  const { session, isSuperAdmin, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: 13, background: '#F8FAFC' }}>
        Checking authorization...
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
        gap: 12,
        color: '#0F172A',
        textAlign: 'center',
        padding: 24,
        background: '#F8FAFC',
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: '#FEE2E2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}>
          <ShieldAlert style={{ width: 24, height: 24, color: '#DC2626' }} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Access Restricted</h2>
        <p style={{ color: '#64748B', fontSize: 13.5, maxWidth: 400, margin: 0, lineHeight: 1.5 }}>
          This portal is strictly limited to Super Admin accounts. Your account does not have super admin permissions.
        </p>
        <button
          onClick={signOut}
          style={{
            marginTop: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            color: '#FFFFFF',
            background: '#2563EB',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
          }}
        >
          <LogOut style={{ width: 14, height: 14 }} /> Sign in with different account
        </button>
      </div>
    )
  }

  return children
}
