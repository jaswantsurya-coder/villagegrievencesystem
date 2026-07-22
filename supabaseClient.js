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

/**
 * Ensures an ID is in valid UUID format (8-4-4-4-12 hex syntax) for PostgreSQL.
 * If the input is already a valid UUID, returns it unchanged.
 * If it's a non-UUID string (e.g. Firebase UID "wcj7Y1dT74SZS2rbTrrwU4S85pY2"),
 * converts it deterministically into a valid UUID string.
 */
export function ensureUUID(idStr) {
  if (!idStr) return idStr;
  const str = String(idStr).trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) return str;

  // Generate 32-char hex string deterministically from input string
  let rawHex = '';
  for (let i = 0; i < str.length; i++) {
    rawHex += str.charCodeAt(i).toString(16).padStart(2, '0');
  }

  let hash1 = 5381, hash2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash1 = (hash1 * 33) ^ ch;
    hash2 = (hash2 * 33) ^ ch;
  }
  const h1Hex = (hash1 >>> 0).toString(16).padStart(8, '0');
  const h2Hex = (hash2 >>> 0).toString(16).padStart(8, '0');

  let combined = (rawHex + h1Hex + h2Hex + '00000000000000000000000000000000').toLowerCase().replace(/[^0-9a-f]/g, '0');
  combined = combined.slice(0, 32);

  return `${combined.slice(0, 8)}-${combined.slice(8, 12)}-4${combined.slice(13, 16)}-a${combined.slice(17, 20)}-${combined.slice(20, 32)}`;
}