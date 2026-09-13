import { createClient } from '@supabase/supabase-js';
import { requireRole, handleAuthError } from './_lib/requireRole.js';

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
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://villagegrievencesystem-fgxb.vercel.app,https://gramseva-superadmin.vercel.app,http://localhost:5173').split(',');
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

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
    // ── Authenticate caller and verify admin role ───────────────────────
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let callerUser, callerProfile;
    try {
      const result = await requireRole(req, ADMIN_ROLES, supabaseAdmin);
      callerUser = result.user;
      callerProfile = result.profile;
    } catch (err) {
      return handleAuthError(res, err);
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
    if (userId.trim() === callerUser.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot reset your own password via admin endpoint. Use the normal password change flow.',
      });
    }

    // ── Load target user's profile for role hierarchy enforcement ─────────
    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, village_id, district')
      .eq('id', userId.trim())
      .single();

    if (targetProfileError || !targetProfile) {
      return res.status(404).json({
        success: false,
        error: 'Target user profile not found.',
      });
    }

    // ── Role hierarchy enforcement (§2.6) ─────────────────────────────────
    const callerRole = callerProfile.role;
    const targetRole = targetProfile.role;

    if (callerRole === 'village_admin') {
      // village_admin can only reset citizen/officer within their own village
      const allowedTargetRoles = ['citizen', 'officer'];
      if (!allowedTargetRoles.includes(targetRole)) {
        return res.status(403).json({
          success: false,
          error: `Village admins can only reset passwords for citizens and officers. Target role: "${targetRole}".`,
        });
      }
      if (targetProfile.village_id !== callerProfile.village_id) {
        return res.status(403).json({
          success: false,
          error: 'You can only reset passwords for users in your own village.',
        });
      }
    } else if (callerRole === 'district_admin') {
      // district_admin can reset citizen, officer, village_admin in their district
      const allowedTargetRoles = ['citizen', 'officer', 'village_admin'];
      if (!allowedTargetRoles.includes(targetRole)) {
        return res.status(403).json({
          success: false,
          error: `District admins cannot reset passwords for role: "${targetRole}".`,
        });
      }
      // Check district ownership: target's village must be in caller's district
      if (targetProfile.village_id && callerProfile.district) {
        const { data: targetVillage } = await supabaseAdmin
          .from('villages')
          .select('district')
          .eq('id', targetProfile.village_id)
          .single();
        if (targetVillage && targetVillage.district !== callerProfile.district) {
          return res.status(403).json({
            success: false,
            error: 'You can only reset passwords for users in your district.',
          });
        }
      }
    }
    // super_admin: no restrictions (can reset anyone)

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
