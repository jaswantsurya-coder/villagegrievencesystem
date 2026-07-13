import { createClient } from '@supabase/supabase-js';

const ADMIN_ROLES = ['village_admin', 'district_admin', 'super_admin'];
const ALLOWED_ROLES = ['citizen', 'officer', 'village_admin'];

export default async function handler(req, res) {
  // CORS headers
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

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[invitations] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error. Contact the administrator.',
    });
  }

  try {
    // Extract and validate JWT
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

    // Initialize Supabase Admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the JWT to identify the caller
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(jwt);

    if (authError || !callerUser) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired authentication token. Please log in again.',
      });
    }

    // Retrieve the caller's profile role and village_id
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, village_id')
      .eq('id', callerUser.id)
      .single();

    if (profileError || !callerProfile) {
      return res.status(403).json({
        success: false,
        error: 'Unable to verify your role. Profile not found.',
      });
    }

    if (!ADMIN_ROLES.includes(callerProfile.role)) {
      return res.status(403).json({
        success: false,
        error: `Unauthorized. Admin role required. Your current role: "${callerProfile.role}".`,
      });
    }

    // Parse parameters
    const { role, email, villageId } = req.body || {};

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role specified. Must be one of: ${ALLOWED_ROLES.join(', ')}`,
      });
    }

    // Scoping village_id:
    // Super admin can specify any villageId.
    // Village/District admins are locked to their own village_id.
    let targetVillageId = null;
    if (callerProfile.role === 'super_admin') {
      if (!villageId) {
        return res.status(400).json({
          success: false,
          error: 'villageId is required for super_admin invitations.',
        });
      }
      targetVillageId = Number(villageId);
    } else {
      targetVillageId = callerProfile.village_id;
      if (!targetVillageId) {
        return res.status(400).json({
          success: false,
          error: 'Your admin account is not associated with any village. Cannot create invitations.',
        });
      }
    }

    // Generate unique token
    // A 32-byte (64 characters) hex string is secure and unguessable
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    // Invitation record insertion
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 100); // 100 years expiration (never expires)

    const { data: inviteData, error: inviteError } = await supabaseAdmin
      .from('invitations')
      .insert({
        token,
        village_id: targetVillageId,
        role,
        email: email ? email.trim().toLowerCase() : null,
        created_by: callerUser.id,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
      })
      .select()
      .single();

    if (inviteError) {
      console.error('[invitations] Database insert error:', inviteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create invitation: ' + inviteError.message,
      });
    }

    // Construct the shareable invitation URL
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'villagegrievencesystem-fgxb.vercel.app';
    const invitationUrl = `${protocol}://${host}/invite/${token}`;

    console.log(`[invitations] Invitation created successfully for village ${targetVillageId}, role ${role} by admin ${callerUser.id}`);

    return res.status(200).json({
      success: true,
      token,
      url: invitationUrl,
      expires_at: inviteData.expires_at,
      invitation: inviteData,
    });
  } catch (err) {
    console.error('[invitations] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
    });
  }
}
