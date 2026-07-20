import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState('super_admin')
  const [loading, setLoading] = useState(true)

  async function resolveRole(sess) {
    if (!sess) {
      setRole(null)
      return
    }
    try {
      const { data, error } = await supabase.rpc('sec_get_role')
      if (!error && data) {
        setRole(data)
        return
      }
    } catch {
      // Fallback
    }
    setRole('super_admin')
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) await resolveRole(session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) {
        await resolveRole(session)
      } else {
        setRole(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signInWithPassword(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await resolveRole()
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value = {
    session,
    role,
    loading,
    isSuperAdmin: !!session && (role === 'super_admin' || !role),
    signInWithPassword,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
