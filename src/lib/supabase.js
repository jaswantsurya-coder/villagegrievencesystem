import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sompzqwvegygtpsrlhzt.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_t1MdRtkflIW6Lfuq7KBotA_IeP5poRA'

const supabaseAuxUrl = import.meta.env.VITE_SUPABASE_AUX_URL || 'https://dtucrczgagpzjbbrwqit.supabase.co'
const supabaseAuxAnonKey = import.meta.env.VITE_SUPABASE_AUX_ANON_KEY || 'sb_publishable_k0ti3YbQtd3y7J2cHF8yMA_HnRa1bhK'
const supabaseAuxServiceKey = import.meta.env.VITE_SUPABASE_AUX_SERVICE_KEY || ''

// Primary Supabase Client (sompzqwvegygtpsrlhzt — SuperAdmin Auth & Admin Requests)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auxiliary Supabase Client (dtucrczgagpzjbbrwqit — Citizen App: profiles, villages, complaints)
export const supabaseAux = createClient(supabaseAuxUrl, supabaseAuxAnonKey)

// Service-role client for admin operations (pilot link generation, bypasses RLS)
export const supabaseAuxAdmin = supabaseAuxServiceKey
  ? createClient(supabaseAuxUrl, supabaseAuxServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

// Citizen app base URL
export const CITIZEN_APP_URL =
  import.meta.env.VITE_CITIZEN_APP_URL || 'https://villagegrievencesystem-fgxb.vercel.app'

// Super Admin Dashboard URL (used in email links)
export const SUPERADMIN_DASHBOARD_URL =
  import.meta.env.VITE_SUPERADMIN_DASHBOARD_URL || 'https://gramseva-superadmin.vercel.app'

// API base URL for serverless functions
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://villagegrievencesystem-fgxb.vercel.app/api'
