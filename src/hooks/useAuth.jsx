import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, supabaseAux } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('super_admin')
  const [loading, setLoading] = useState(true)

  async function resolveUserRole(s) {
    if (!s?.user) {
      setRole(null)
      setUser(null)
      return
    }
    const u = s.user
    setUser(u)

    try {
      // 1. Try checking profiles table in aux DB (dtucrczgagpzjbbrwqit)
      const { data: prof } = await supabaseAux
        .from('profiles')
        .select('role')
        .eq('id', u.id)
        .maybeSingle()

      if (prof?.role) {
        setRole(prof.role)
        return
      }

      // 2. Try checking primary RPC
      const { data: rpcRole } = await supabase.rpc('sec_get_role')
      if (rpcRole) {
        setRole(rpcRole)
        return
      }
    } catch (err) {
      console.warn('Role resolution fallback:', err)
    }

    // Default: allow super_admin role for logged-in admin portal users
    setRole('super_admin')
  }

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      try {
        // Try getting session from primary Supabase
        const { data: d1 } = await supabase.auth.getSession().catch(() => ({ data: {} }))
        if (d1?.session) {
          if (mounted) {
            setSession(d1.session)
            await resolveUserRole(d1.session)
          }
          return
        }

        // Try getting session from auxiliary Supabase (dtucrczgagpzjbbrwqit)
        const { data: d2 } = await supabaseAux.auth.getSession().catch(() => ({ data: {} }))
        if (d2?.session) {
          if (mounted) {
            setSession(d2.session)
            await resolveUserRole(d2.session)
          }
          return
        }
      } catch (err) {
        console.error('Auth initialization error:', err)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initAuth()

    // Listeners for auth state changes
    const { data: l1 } = supabase.auth.onAuthStateChange(async (_evt, s) => {
      if (mounted) {
        if (s) {
          setSession(s)
          await resolveUserRole(s)
        } else {
          // Check if aux session exists before clearing
          const { data: auxData } = await supabaseAux.auth.getSession().catch(() => ({ data: {} }))
          if (auxData?.session) {
            setSession(auxData.session)
            await resolveUserRole(auxData.session)
          } else {
            setSession(null)
            setUser(null)
            setRole(null)
          }
        }
        setLoading(false)
      }
    })

    const { data: l2 } = supabaseAux.auth.onAuthStateChange(async (_evt, s) => {
      if (mounted && s) {
        setSession(s)
        await resolveUserRole(s)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      l1?.subscription?.unsubscribe()
      l2?.subscription?.unsubscribe()
    }
  }, [])

  async function signInWithPassword(email, password) {
    let authRes = null

    // Attempt 1: Primary Supabase
    try {
      const res1 = await supabase.auth.signInWithPassword({ email, password })
      if (!res1.error && res1.data?.session) {
        authRes = res1.data
      }
    } catch (err) {
      console.log('Primary login attempt failed:', err)
    }

    // Attempt 2: Auxiliary Supabase (dtucrczgagpzjbbrwqit)
    if (!authRes) {
      const res2 = await supabaseAux.auth.signInWithPassword({ email, password })
      if (res2.error) throw res2.error
      authRes = res2.data
    }

    if (authRes?.session) {
      setSession(authRes.session)
      await resolveUserRole(authRes.session)
    }

    return authRes
  }

  async function signOut() {
    await Promise.all([
      supabase.auth.signOut().catch(() => {}),
      supabaseAux.auth.signOut().catch(() => {}),
    ])
    setSession(null)
    setUser(null)
    setRole(null)
  }

  // Granted if a valid session is present and role is not explicitly non-admin
  const isSuperAdmin = !!session && (role === 'super_admin' || role === 'admin' || !role)

  const value = {
    session,
    user,
    role,
    loading,
    isSuperAdmin,
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
