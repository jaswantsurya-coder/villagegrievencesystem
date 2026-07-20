import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('super_admin')
  const [loading, setLoading] = useState(true)

  async function resolveRole(sess) {
    if (!sess) {
      setRole(null)
      setUser(null)
      return
    }
    setUser(sess.user)
    try {
      const { data, error } = await supabase.rpc('sec_get_role')
      if (!error && data) {
        setRole(data)
        return
      }
    } catch {
      // Fallback role for super admin portal
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
        setUser(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signInWithPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (data?.session) {
      setSession(data.session)
      await resolveRole(data.session)
    }
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setRole(null)
  }

  const value = {
    session,
    user,
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
