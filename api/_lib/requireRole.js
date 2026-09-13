import { createClient } from '@supabase/supabase-js';

/**
 * requireRole — Shared authorization middleware for Vercel serverless API routes.
 *
 * Extracts Bearer JWT from the request, verifies it against Supabase Auth,
 * loads the caller's profile, and asserts the role is in `allowedRoles`.
 *
 * @param {import('http').IncomingMessage} req — The incoming request (must have `headers.authorization`)
 * @param {string[]} allowedRoles — Array of roles that are permitted (e.g. ['super_admin'])
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin — Admin client (service_role key)
 * @returns {Promise<{user: object, profile: object}>} — The authenticated user and their profile row
 * @throws {{ status: number, message: string }} — On auth/authz failure
 */
export async function requireRole(req, allowedRoles, supabaseAdmin) {
  // 1. Extract Bearer token
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw { status: 401, message: 'Unauthorized. Bearer token required.' };
  }

  const token = authHeader.replace('Bearer ', '');

  // 2. Verify JWT via Supabase Auth
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    throw { status: 401, message: 'Invalid or expired token.' };
  }

  // 3. Load the caller's profile to check role
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, village_id, district, email, name')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw { status: 403, message: 'Profile not found. Cannot determine role.' };
  }

  // 4. Assert role is in allowed list
  if (!allowedRoles.includes(profile.role)) {
    throw {
      status: 403,
      message: `Forbidden. Requires one of: ${allowedRoles.join(', ')}. Your role: ${profile.role}`,
    };
  }

  return { user, profile };
}

/**
 * verifyInternalSecret — Checks X-Internal-Secret header for server-to-server calls.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {boolean} — true if the secret matches
 */
export function verifyInternalSecret(req) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false; // Fail closed if not configured

  const provided = req.headers['x-internal-secret'] || '';
  if (!provided) return false;

  // Constant-time comparison
  if (secret.length !== provided.length) return false;

  let mismatch = 0;
  for (let i = 0; i < secret.length; i++) {
    mismatch |= secret.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * handleAuthError — Utility to send a structured error response from requireRole/verifyInternalSecret.
 *
 * @param {import('http').ServerResponse} res
 * @param {object} err — Error thrown by requireRole ({ status, message })
 */
export function handleAuthError(res, err) {
  const status = err?.status || 500;
  const message = err?.message || 'Internal server error';
  return res.status(status).json({ success: false, error: message });
}
