import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sompzqwvegygtpsrlhzt.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_t1MdRtkflIW6Lfuq7KBotA_IeP5poRA'

const supabaseAuxUrl = import.meta.env.VITE_SUPABASE_AUX_URL || 'https://dtucrczgagpzjbbrwqit.supabase.co'
const supabaseAuxAnonKey = import.meta.env.VITE_SUPABASE_AUX_ANON_KEY || 'sb_publishable_t1MdRtkflIW6Lfuq7KBotA_IeP5poRA'

// Primary Supabase Client (sompzqwvegygtpsrlhzt - SuperAdmin & Auth)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auxiliary Supabase Client (dtucrczgagpzjbbrwqit - Citizen Grievances & Telemetry)
export const supabaseAux = createClient(supabaseAuxUrl, supabaseAuxAnonKey)
