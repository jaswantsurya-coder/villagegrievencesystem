import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Early recovery detection (MUST run before createClient) ──────────────
// When user clicks the password reset link from email, Supabase redirects back
// with tokens in the URL. We capture this BEFORE createClient() processes and
// clears the hash, so the React app can show the password reset form.
export const _passwordRecoveryDetected = (() => {
  try {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const path = window.location.pathname;
    // Hash fragment flow: #access_token=...&type=recovery
    if (hash.includes('type=recovery')) return true;
    // PKCE flow: ?code=...  (we'll verify recovery type after exchange)
    const params = new URLSearchParams(search);
    if (params.get('type') === 'recovery') return true;
    if (params.get('code') && hash.includes('recovery')) return true;
    // Path-based detection: user landed on /reset-password with tokens
    if (path === '/reset-password' && (hash || params.get('code'))) return true;
  } catch (e) { /* ignore */ }
  return false;
})();

export const supabaseConfigError = !supabaseUrl || !supabaseKey
  ? 'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel for Production and Preview.'
  : '';

export const supabase = supabaseConfigError ? null : createClient(supabaseUrl, supabaseKey);