import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, supabaseAux } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('super_admin')
  const [loading, setLoading] = useState(true)
  const [activeClient, setActiveClient] = useState('primary')

  async function resolveRole(sess, clientType = 'primary') {
    if (!sess || !sess.user) {
      setRole(null)
      setUser(null)
      return
    }
    const u = sess.user
    setUser(u)

    try {
      // 1. Check profiles table in aux database (dtucrczgagpzjbbrwqit)
      const { data: prof } = await supabaseAux
        .from('profiles')
        .select('role')
        .eq('id', u.id)
        .maybeSingle()

      if (prof?.role) {
        setRole(prof.role)
        return
      }

      // 2. Check primary RPC (sompzqwvegygtpsrlhzt)
      const { data: rpcRole, error } = await supabase.rpc('sec_get_role')
      if (!error && rpcRole) {
        setRole(rpcRole)
        return
      }

      // 3. Check user_metadata or app_metadata
      const metaRole = u.user_metadata?.role || u.app_metadata?.role
      if (metaRole) {
        setRole(metaRole)
        return
      }
    } catch (err) {
      console.warn('Role resolution warning:', err)
    }

    // Default to super_admin for authenticated portal users
    setRole('super_admin')
  }

  useEffect(() => {
    // Check session on primary client first
    supabase.auth.getSession().then(async ({ data: { session: s1 } }) => {
      if (s1) {
        setSession(s1)
        setActiveClient('primary')
        await resolveRole(s1, 'primary')
        setLoading(false)
        return
      }

      // Fallback: check session on aux client (dtucrczgagpzjbbrwqit)
      supabaseAux.auth.getSession().then(async ({ data: { session: s2 } }) => {
        if (s2) {
          setSession(s2)
          setActiveClient('aux')
          await resolveRole(s2, 'aux')
        }
        setLoading(false)
      })
    })

    // Listeners for both clients
    const { data: l1 } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (s) {
        setSession(s)
        setActiveClient('primary')
        await resolveRole(s, 'primary')
      }
    })

    const { data: l2 } = supabaseAux.auth.onAuthStateChange(async (_event, s) => {
      if (s && !session) {
        setSession(s)
        setActiveClient('aux')
        await resolveRole(s, 'aux')
      }
    })

    return () => {
      l1?.subscription?.unsubscribe()
      l2?.subscription?.unsubscribe()
    }
  }, [])

  async function signInWithPassword(email, password) {
    let authRes = null
    let usedClient = 'primary'

    // Try primary Supabase first
    try {
      const res1 = await supabase.auth.signInWithPassword({ email, password })
      if (!res1.error && res1.data?.session) {
        authRes = res1.data
        usedClient = 'primary'
      }
    } catch (err) {
      console.log('Primary auth attempt failed, trying aux database...', err)
    }

    // If primary failed, try aux Supabase (dtucrczgagpzjbbrwqit)
    if (!authRes) {
      const res2 = await supabaseAux.auth.signInWithPassword({ email, password })
      if (res2.error) throw res2.error
      authRes = res2.data
      usedClient = 'aux'
    }

    if (authRes?.session) {
      setSession(authRes.session)
      setActiveClient(usedClient)
      await resolveRole(authRes.session, usedClient)
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

  // A user logged into the Super Admin portal is granted Super Admin access
  // unless explicitly resolved as non-admin in profiles.
  const isSuperAdmin = !!session && (role === 'super_admin' || role === 'admin' || !role || role === null)

  const value = {
    session,
    user,
    role,
    activeClient,
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
