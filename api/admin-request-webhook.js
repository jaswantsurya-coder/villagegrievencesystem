import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppNotification } from './whatsapp.js';

/**
 * POST /api/admin-request-webhook
 * Receives admin request submissions from the Admin Request Portal.
 * - Inserts into admin_requests table
 * - Sends Brevo email notification to Super Admin
 * - Sends Firebase FCM push notification to Super Admin
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://sompzqwvegygtpsrlhzt.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || 'gramseva0089@gmail.com';
  const brevoSenderName = process.env.BREVO_SENDER_NAME || 'GramSeva';

  if (!serviceRoleKey) {
    return res.status(500).json({ success: false, error: 'Server configuration error: missing SUPABASE_SERVICE_ROLE_KEY.' });
  }

  try {
    const body = req.body || {};

    // Validate required fields
    const requiredFields = ['full_name', 'email', 'village_name', 'district', 'state'];
    const missing = requiredFields.filter(f => !body[f]);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    // Initialize Supabase Admin
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Build record
    const record = {
      full_name: body.full_name,
      email: body.email.trim().toLowerCase(),
      phone: body.phone || null,
      state: body.state,
      district: body.district,
      mandal: body.mandal || null,
      village_name: body.village_name,
      address: body.address || null,
      gender: body.gender || null,
      aadhaar_number: body.aadhaar_number || null,
      government_id_url: body.government_id_url || null,
      profile_photo_url: body.profile_photo_url || null,
      reason: body.reason || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // Insert into admin_requests
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('admin_requests')
      .insert(record)
      .select()
      .single();

    if (insertErr) {
      console.error('[webhook] Insert error:', insertErr);
      return res.status(500).json({ success: false, error: 'Failed to save request: ' + insertErr.message });
    }

    console.log(`[webhook] Admin request saved: ${inserted.request_id || inserted.id}`);

    // ─── Send Brevo Email to Super Admin ─────────────────────────────
    if (brevoApiKey) {
      try {
        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || brevoSenderEmail;
        const submittedAt = new Date(inserted.created_at).toLocaleString('en-IN', {
          dateStyle: 'long',
          timeStyle: 'short',
          timeZone: 'Asia/Kolkata',
        });

        const dashboardUrl = process.env.SUPERADMIN_DASHBOARD_URL || 'https://gramseva-superadmin.vercel.app';

        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoApiKey,
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            sender: { name: brevoSenderName, email: brevoSenderEmail },
            to: [{ email: superAdminEmail, name: 'Super Admin' }],
            subject: 'New Village Administrator Request Received',
            htmlContent: `
              <div style="font-family:'Inter',Arial,sans-serif;max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
                <div style="background:linear-gradient(135deg,#1D4ED8,#2563EB);padding:28px 32px;text-align:center;">
                  <h1 style="color:#FFFFFF;font-size:20px;font-weight:800;margin:0;">🔔 New Village Admin Request</h1>
                  <p style="color:#BFDBFE;font-size:13px;margin:8px 0 0;">A new Village Administrator request has been submitted.</p>
                </div>
                <div style="padding:28px 32px;">
                  <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <tr><td style="padding:10px 0;color:#64748B;font-weight:600;">Name:</td><td style="padding:10px 0;color:#0F172A;font-weight:700;">${inserted.full_name}</td></tr>
                    <tr><td style="padding:10px 0;color:#64748B;font-weight:600;">Village:</td><td style="padding:10px 0;color:#0F172A;">${inserted.village_name}</td></tr>
                    <tr><td style="padding:10px 0;color:#64748B;font-weight:600;">District:</td><td style="padding:10px 0;color:#0F172A;">${inserted.district}</td></tr>
                    <tr><td style="padding:10px 0;color:#64748B;font-weight:600;">State:</td><td style="padding:10px 0;color:#0F172A;">${inserted.state}</td></tr>
                    <tr><td style="padding:10px 0;color:#64748B;font-weight:600;">Phone:</td><td style="padding:10px 0;color:#0F172A;">${inserted.phone || '—'}</td></tr>
                    <tr><td style="padding:10px 0;color:#64748B;font-weight:600;">Email:</td><td style="padding:10px 0;color:#0F172A;">${inserted.email}</td></tr>
                    <tr><td style="padding:10px 0;color:#64748B;font-weight:600;">Submitted At:</td><td style="padding:10px 0;color:#0F172A;">${submittedAt}</td></tr>
                    <tr><td style="padding:10px 0;color:#64748B;font-weight:600;">Request ID:</td><td style="padding:10px 0;color:#2563EB;font-weight:700;font-family:monospace;">${inserted.request_id || '—'}</td></tr>
                  </table>
                  <p style="color:#64748B;font-size:13px;margin:20px 0 16px;">Please review the request from the Super Admin Dashboard.</p>
                  <a href="${dashboardUrl}/approvals" style="display:inline-block;padding:12px 28px;background:#2563EB;color:#FFFFFF;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">Review Request</a>
                </div>
                <div style="padding:16px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;text-align:center;">
                  <p style="font-size:11px;color:#94A3B8;margin:0;">GramSeva — Village Grievance Management System</p>
                </div>
              </div>
            `,
          }),
        });
        console.log('[webhook] Brevo email sent to Super Admin');
      } catch (emailErr) {
        console.error('[webhook] Brevo email error:', emailErr);
      }
    // ─── Send Firebase FCM to Super Admin ────────────────────────────
    try {
      await sendFCMToSuperAdmin(supabaseAdmin, inserted);
    } catch (fcmErr) {
      console.error('[webhook] FCM error:', fcmErr);
    }

    // ─── Send WhatsApp Notifications ──────────────────────────────────
    try {
      // Send to applicant
      if (inserted.phone) {
        await sendWhatsAppNotification({
          to: inserted.phone,
          type: 'submission_applicant',
          data: inserted,
        });
      }
      // Send to Super Admin
      const superAdminPhone = process.env.SUPER_ADMIN_PHONE || process.env.SUPERADMIN_PHONE || '+919876543210';
      if (superAdminPhone) {
        await sendWhatsAppNotification({
          to: superAdminPhone,
          type: 'submission_superadmin',
          data: inserted,
        });
      }
      console.log('[webhook] WhatsApp notifications triggered successfully');
    } catch (waErr) {
      console.error('[webhook] WhatsApp notification error:', waErr);
    }

    return res.status(200).json({
      success: true,
      request_id: inserted.request_id,
      id: inserted.id,
      message: 'Admin request submitted successfully.',
    });
  } catch (err) {
    console.error('[webhook] Unexpected error:', err);
    return res.status(500).json({ success: false, error: 'An unexpected error occurred.' });
  }
}

/**
 * Send Firebase Cloud Messaging push notification to all Super Admin device tokens.
 */
async function sendFCMToSuperAdmin(supabaseAdmin, request) {
  const firebaseJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!firebaseJson) {
    console.warn('[FCM] No FIREBASE_SERVICE_ACCOUNT_JSON configured');
    return;
  }

  // Get Super Admin FCM tokens
  const { data: tokens, error: tokErr } = await supabaseAdmin
    .from('notification_tokens')
    .select('fcm_token')
    .eq('role', 'super_admin');

  if (tokErr || !tokens || tokens.length === 0) {
    console.log('[FCM] No super_admin FCM tokens found');
    return;
  }

  // Parse service account
  let serviceAccount;
  try {
    serviceAccount = typeof firebaseJson === 'string' ? JSON.parse(firebaseJson) : firebaseJson;
  } catch {
    console.error('[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON');
    return;
  }

  // Get OAuth2 access token for FCM v1 API
  const accessToken = await getFirebaseAccessToken(serviceAccount);
  if (!accessToken) return;

  const projectId = serviceAccount.project_id;

  // Send to each token
  for (const { fcm_token } of tokens) {
    try {
      await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: fcm_token,
            notification: {
              title: 'New Village Admin Request',
              body: `${request.full_name} has submitted a new administrator request for ${request.village_name}.`,
            },
            webpush: {
              fcm_options: {
                link: '/approvals',
              },
            },
            data: {
              type: 'admin_request',
              request_id: request.request_id || '',
              click_action: '/approvals',
            },
          },
        }),
      });
    } catch (sendErr) {
      console.error('[FCM] Send error for token:', fcm_token?.substring(0, 20), sendErr);
    }
  }
  console.log(`[FCM] Push sent to ${tokens.length} super_admin device(s)`);
}

/**
 * Get Firebase OAuth2 access token using service account JWT.
 */
async function getFirebaseAccessToken(serviceAccount) {
  try {
    const { default: jwt } = await import('jsonwebtoken');

    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
      {
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      },
      serviceAccount.private_key,
      { algorithm: 'RS256' }
    );

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`,
    });

    const data = await resp.json();
    return data.access_token || null;
  } catch (err) {
    console.error('[FCM] OAuth token error:', err);
    return null;
  }
}
