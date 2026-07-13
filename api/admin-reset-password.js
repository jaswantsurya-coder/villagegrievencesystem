import { createClient } from '@supabase/supabase-js';

// ─── Type Definitions (JSDoc) ─────────────────────────────────────────────────

/**
 * @typedef {Object} ResetPasswordRequest
 * @property {string} userId - UUID of the user whose password is being reset
 * @property {string} newPassword - The new password to set
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success
 * @property {string} [message]
 * @property {string} [error]
 * @property {Object} [user]
 */

// ─── Validation Helpers ───────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate that the userId is a proper UUID v4 format
 * @param {string} userId
 * @returns {string|null} error message or null if valid
 */
function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    return 'userId is required and must be a string.';
  }
  if (!UUID_REGEX.test(userId.trim())) {
    return 'Invalid userId format. Must be a valid UUID.';
  }
  return null;
}

/**
 * Validate password strength:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * @param {string} password
 * @returns {string|null} error message or null if valid
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return 'newPassword is required and must be a string.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one special character (e.g., @, #, $, !, etc.).';
  }
  return null;
}

// ─── Admin Role Validation ────────────────────────────────────────────────────

const ADMIN_ROLES = ['village_admin', 'district_admin', 'super_admin'];

// ─── Main Handler ─────────────────────────────────────────────────────────────

/**
 * Vercel Serverless Function: Admin-only password reset
 *
 * POST /api/admin-reset-password
 *
 * Headers:
 *   Authorization: Bearer <supabase-jwt>
 *
 * Body:
 *   { "userId": "<uuid>", "newPassword": "<strong-password>" }
 *
 * Security:
 *   1. Validates JWT via Supabase anon client
 *   2. Checks caller's profile.role is in ADMIN_ROLES
 *   3. Uses SERVICE_ROLE_KEY (server-side only) to update the target user's password
 */
export default async function handler(req, res) {
  // ── CORS headers ──────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.',
    });
  }

  // ── Check environment variables ───────────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    const missing = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    console.error(`[admin-reset-password] Missing env vars: ${missing.join(', ')}`);
    return res.status(500).json({
      success: false,
      error: `Server configuration error: missing ${missing.join(' and ')}. Set these in Vercel Dashboard → Project Settings → Environment Variables.`,
    });
  }

  try {
    // ── Extract and validate JWT ──────────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid Authorization header. Use: Bearer <token>',
      });
    }

    const jwt = authHeader.replace('Bearer ', '').trim();
    if (!jwt) {
      return res.status(401).json({
        success: false,
        error: 'Empty JWT token.',
      });
    }

    // ── Verify the caller's identity using the anon key ───────────────────
    // We use the anon key to verify the JWT (read-only, safe for this purpose)
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    // Create an admin client (with service role) for password update
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the JWT by getting the user it belongs to
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(jwt);

    if (authError || !callerUser) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired authentication token. Please log in again.',
      });
    }

    // ── Check caller's admin role ─────────────────────────────────────────
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (profileError || !callerProfile) {
      return res.status(403).json({
        success: false,
        error: 'Unable to verify your admin role. Profile not found.',
      });
    }

    if (!ADMIN_ROLES.includes(callerProfile.role)) {
      return res.status(403).json({
        success: false,
        error: `Unauthorized. Admin role required. Your current role: "${callerProfile.role}".`,
      });
    }

    // ── Parse and validate request body ───────────────────────────────────
    const { userId, newPassword } = req.body || {};

    const userIdError = validateUserId(userId);
    if (userIdError) {
      return res.status(400).json({ success: false, error: userIdError });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError });
    }

    // ── Prevent self-password-reset via admin endpoint ─────────────────────
    // Admins should use the normal password change flow for their own account
    if (userId.trim() === callerUser.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot reset your own password via admin endpoint. Use the normal password change flow.',
      });
    }

    // ── Update the target user's password ─────────────────────────────────
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId.trim(),
      { password: newPassword }
    );

    if (updateError) {
      console.error('[admin-reset-password] updateUserById error:', updateError);

      // Map common Supabase errors to user-friendly messages
      const msg = updateError.message?.toLowerCase() || '';
      if (msg.includes('not found') || msg.includes('user not found')) {
        return res.status(404).json({
          success: false,
          error: `User not found with ID: ${userId}`,
        });
      }
      if (msg.includes('weak') || msg.includes('password')) {
        return res.status(400).json({
          success: false,
          error: 'Password rejected by Supabase: ' + updateError.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to update password: ' + updateError.message,
      });
    }

    // ── Success ───────────────────────────────────────────────────────────
    console.log(`[admin-reset-password] Password reset for user ${userId} by admin ${callerUser.id} (${callerProfile.role})`);

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.',
      user: {
        id: updatedUser?.user?.id || userId,
        email: updatedUser?.user?.email || null,
        updated_at: updatedUser?.user?.updated_at || new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[admin-reset-password] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
    });
  }
}
