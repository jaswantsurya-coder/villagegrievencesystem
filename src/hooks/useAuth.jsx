import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, supabaseAux } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('super_admin')
  const [loading, setLoading] = useState(true)

  async function resolveUserRole(s) {
    if (!s?.user) return
    setUser(s.user)

    try {
      // Background role lookup — non-blocking
      const [profRes, rpcRes] = await Promise.allSettled([
        supabaseAux.from('profiles').select('role').eq('id', s.user.id).maybeSingle(),
        supabase.rpc('sec_get_role'),
      ])

      if (profRes.status === 'fulfilled' && profRes.value?.data?.role) {
        setRole(profRes.value.data.role)
        return
      }
      if (rpcRes.status === 'fulfilled' && rpcRes.value?.data) {
        setRole(rpcRes.value.data)
        return
      }
    } catch {
      // Keep super_admin default for portal
    }
    setRole('super_admin')
  }

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      try {
        // Check primary session
        const { data: d1 } = await supabase.auth.getSession().catch(() => ({ data: {} }))
        if (d1?.session && mounted) {
          setSession(d1.session)
          setUser(d1.session.user)
          setRole('super_admin')
          setLoading(false)
          resolveUserRole(d1.session)
          return
        }

        // Check aux session
        const { data: d2 } = await supabaseAux.auth.getSession().catch(() => ({ data: {} }))
        if (d2?.session && mounted) {
          setSession(d2.session)
          setUser(d2.session.user)
          setRole('super_admin')
          setLoading(false)
          resolveUserRole(d2.session)
          return
        }
      } catch (err) {
        console.error('Auth init error:', err)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initAuth()

    // Auth listeners
    const { data: l1 } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (!mounted) return
      if (s) {
        setSession(s)
        setUser(s.user)
        setRole('super_admin')
        resolveUserRole(s)
      } else {
        setSession(null)
        setUser(null)
      }
      setLoading(false)
    })

    const { data: l2 } = supabaseAux.auth.onAuthStateChange((_evt, s) => {
      if (!mounted) return
      if (s) {
        setSession(s)
        setUser(s.user)
        setRole('super_admin')
        resolveUserRole(s)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      l1?.subscription?.unsubscribe()
      l2?.subscription?.unsubscribe()
    }
  }, [])

  async function signInWithPassword(email, password) {
    let authRes = null

    try {
      const res1 = await supabase.auth.signInWithPassword({ email, password })
      if (!res1.error && res1.data?.session) {
        authRes = res1.data
      }
    } catch {
      // Ignore & try aux
    }

    if (!authRes) {
      const res2 = await supabaseAux.auth.signInWithPassword({ email, password })
      if (res2.error) throw res2.error
      authRes = res2.data
    }

    if (authRes?.session) {
      setSession(authRes.session)
      setUser(authRes.session.user)
      setRole('super_admin')
      resolveUserRole(authRes.session)
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
