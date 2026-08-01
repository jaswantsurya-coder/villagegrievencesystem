import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/admin-request-action
 * Server-side handler for Approve/Reject actions.
 * 
 * Body: { action: 'approve' | 'reject', requestId: UUID, reason?: string, notes?: string }
 * Auth: Bearer JWT (Super Admin)
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  // Config
  const primaryUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://sompzqwvegygtpsrlhzt.supabase.co';
  const primaryServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const auxUrl = process.env.SUPABASE_AUX_URL || process.env.VITE_SUPABASE_AUX_URL || 'https://dtucrczgagpzjbbrwqit.supabase.co';
  const auxServiceKey = process.env.SUPABASE_AUX_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || 'gramseva0089@gmail.com';
  const brevoSenderName = process.env.BREVO_SENDER_NAME || 'GramSeva';
  const dashboardUrl = process.env.SUPERADMIN_DASHBOARD_URL || 'https://gramseva-superadmin.vercel.app';
  const citizenAppUrl = process.env.CITIZEN_APP_URL || 'https://villagegrievencesystem-fgxb.vercel.app';

  if (!primaryServiceKey) {
    return res.status(500).json({ success: false, error: 'Missing SUPABASE_SERVICE_ROLE_KEY.' });
  }

  try {
    // Authenticate caller
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing Authorization header.' });
    }

    const jwt = authHeader.replace('Bearer ', '').trim();
    const supabaseAdmin = createClient(primaryUrl, primaryServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt);
    if (authErr || !user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }

    // Parse body
    const { action, requestId, reason, notes } = req.body || {};

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid action. Must be "approve" or "reject".' });
    }
    if (!requestId) {
      return res.status(400).json({ success: false, error: 'Missing requestId.' });
    }

    // Fetch the request
    const { data: request, error: fetchErr } = await supabaseAdmin
      .from('admin_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchErr || !request) {
      return res.status(404).json({ success: false, error: 'Request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, error: `Request is already ${request.status}.` });
    }

    // ═══════════════════════════════════════════════════════════════════
    // APPROVE
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'approve') {
      // 1. Initialize aux Supabase for village/invitation operations
      const supabaseAuxAdmin = auxServiceKey
        ? createClient(auxUrl, auxServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
        : null;

      // 2. Create village if it doesn't exist (in aux DB)
      let villageId = null;
      if (supabaseAuxAdmin) {
        const { data: existingVillage } = await supabaseAuxAdmin
          .from('villages')
          .select('id')
          .ilike('name', request.village_name)
          .maybeSingle();

        if (existingVillage) {
          villageId = existingVillage.id;
        } else {
          const { data: newVillage, error: villageErr } = await supabaseAuxAdmin
            .from('villages')
            .insert({
              name: request.village_name,
              district: request.district,
              state: request.state || 'Andhra Pradesh',
              mandal: request.mandal || null,
            })
            .select()
            .single();

          if (!villageErr && newVillage) {
            villageId = newVillage.id;
            console.log(`[action] Created village: ${newVillage.name} (ID: ${newVillage.id})`);
          }
        }
      }

      // 3. Generate invitation token
      const crypto = await import('crypto');
      const invitationToken = crypto.randomBytes(32).toString('hex');
      const invitationUrl = `${citizenAppUrl}/invite/${invitationToken}`;

      // 4. Store invitation in aux DB
      if (supabaseAuxAdmin && villageId) {
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 100);

        await supabaseAuxAdmin.from('invitations').insert({
          token: invitationToken,
          village_id: villageId,
          role: 'village_admin',
          email: request.email || null,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
          status: 'pending',
        });
      }

      // 5. Update admin_requests status
      await supabaseAdmin.from('admin_requests').update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        reviewer_notes: notes || 'Verified & Approved by SuperAdmin',
        invitation_token: invitationToken,
        invitation_url: invitationUrl,
      }).eq('id', requestId);

      // 6. Send approval email to applicant via Brevo
      if (brevoApiKey && request.email) {
        try {
          await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'api-key': brevoApiKey,
              'Content-Type': 'application/json',
              accept: 'application/json',
            },
            body: JSON.stringify({
              sender: { name: brevoSenderName, email: brevoSenderEmail },
              to: [{ email: request.email, name: request.full_name || 'Applicant' }],
              subject: `[GramSeva] 🎉 Admin Request APPROVED — ${request.village_name}`,
              htmlContent: `
                <div style="font-family:'Inter',Arial,sans-serif;max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
                  <div style="background:linear-gradient(135deg,#15803D,#22C55E);padding:28px 32px;text-align:center;">
                    <h1 style="color:#FFFFFF;font-size:20px;font-weight:800;margin:0;">✅ Admin Access Approved!</h1>
                    <p style="color:#BBF7D0;font-size:13px;margin:8px 0 0;">Your Village Administrator request has been approved.</p>
                  </div>
                  <div style="padding:28px 32px;">
                    <p style="font-size:14px;color:#0F172A;line-height:1.6;">Dear <strong>${request.full_name || 'Applicant'}</strong>,</p>
                    <p style="font-size:14px;color:#334155;line-height:1.6;">Your admin verification for <strong>${request.village_name}</strong> (${request.district}, ${request.state || 'AP'}) has been approved by the Super Admin.</p>
                    <p style="font-size:14px;color:#334155;line-height:1.6;">Use the invitation link below to set up your Village Administrator account:</p>
                    <div style="text-align:center;margin:24px 0;">
                      <a href="${invitationUrl}" style="display:inline-block;padding:14px 32px;background:#2563EB;color:#FFFFFF;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">Accept Invitation & Set Up Account</a>
                    </div>
                    <div style="background:#F0FDF4;border:1px solid #DCFCE7;border-radius:10px;padding:12px 16px;margin:16px 0;">
                      <p style="font-size:12px;color:#166534;margin:0;"><strong>Request ID:</strong> ${request.request_id || '—'}</p>
                      <p style="font-size:12px;color:#166534;margin:4px 0 0;"><strong>Village:</strong> ${request.village_name}</p>
                    </div>
                  </div>
                  <div style="padding:16px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;text-align:center;">
                    <p style="font-size:11px;color:#94A3B8;margin:0;">GramSeva — Village Grievance Management System</p>
                  </div>
                </div>
              `,
            }),
          });
          console.log('[action] Approval email sent to:', request.email);
        } catch (emailErr) {
          console.error('[action] Approval email error:', emailErr);
        }
      }

      // 7. Send FCM push to applicant
      await sendFCMToApplicant(supabaseAuxAdmin || supabaseAdmin, request, {
        title: '🎉 Admin Request Approved!',
        body: `Your Village Administrator request for ${request.village_name} has been approved. Check your email for the invitation link.`,
        link: invitationUrl,
      });

      return res.status(200).json({
        success: true,
        action: 'approved',
        invitation_url: invitationUrl,
        village_id: villageId,
        message: `Request approved. Invitation sent to ${request.email}.`,
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // REJECT
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'reject') {
      // 1. Update admin_requests status
      await supabaseAdmin.from('admin_requests').update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        rejection_reason: reason || 'Request could not be approved at this time.',
      }).eq('id', requestId);

      // 2. Send rejection email
      if (brevoApiKey && request.email) {
        try {
          await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'api-key': brevoApiKey,
              'Content-Type': 'application/json',
              accept: 'application/json',
            },
            body: JSON.stringify({
              sender: { name: brevoSenderName, email: brevoSenderEmail },
              to: [{ email: request.email, name: request.full_name || 'Applicant' }],
              subject: `[GramSeva] Admin Request Update — ${request.village_name}`,
              htmlContent: `
                <div style="font-family:'Inter',Arial,sans-serif;max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
                  <div style="background:linear-gradient(135deg,#991B1B,#DC2626);padding:28px 32px;text-align:center;">
                    <h1 style="color:#FFFFFF;font-size:20px;font-weight:800;margin:0;">Request Not Approved</h1>
                    <p style="color:#FECACA;font-size:13px;margin:8px 0 0;">Your Village Administrator request could not be approved.</p>
                  </div>
                  <div style="padding:28px 32px;">
                    <p style="font-size:14px;color:#0F172A;line-height:1.6;">Dear <strong>${request.full_name || 'Applicant'}</strong>,</p>
                    <p style="font-size:14px;color:#334155;line-height:1.6;">Your request for Village Administrator access to <strong>${request.village_name}</strong> (${request.district}) could not be approved at this time.</p>
                    ${reason ? `
                      <div style="background:#FEF2F2;border:1px solid #FEE2E2;border-radius:10px;padding:14px 16px;margin:16px 0;">
                        <p style="font-size:12px;color:#991B1B;font-weight:700;margin:0 0 4px;">Reason:</p>
                        <p style="font-size:13px;color:#7F1D1D;margin:0;">${reason}</p>
                      </div>
                    ` : ''}
                    <p style="font-size:13px;color:#64748B;margin:16px 0 0;">You may reapply after addressing the above concerns.</p>
                  </div>
                  <div style="padding:16px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;text-align:center;">
                    <p style="font-size:11px;color:#94A3B8;margin:0;">GramSeva — Village Grievance Management System</p>
                  </div>
                </div>
              `,
            }),
          });
          console.log('[action] Rejection email sent to:', request.email);
        } catch (emailErr) {
          console.error('[action] Rejection email error:', emailErr);
        }
      }

      // 3. Send FCM push to applicant
      const supabaseAuxAdmin = auxServiceKey
        ? createClient(auxUrl, auxServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
        : null;

      await sendFCMToApplicant(supabaseAuxAdmin || supabaseAdmin, request, {
        title: 'Admin Request Update',
        body: `Your Village Administrator request for ${request.village_name} could not be approved.${reason ? ' Reason: ' + reason : ''}`,
        link: '/',
      });

      return res.status(200).json({
        success: true,
        action: 'rejected',
        message: `Request rejected. Notification sent to ${request.email}.`,
      });
    }
  } catch (err) {
    console.error('[action] Unexpected error:', err);
    return res.status(500).json({ success: false, error: 'An unexpected error occurred.' });
  }
}

/**
 * Send FCM push notification to the applicant if they have a registered token.
 */
async function sendFCMToApplicant(supabaseClient, request, notification) {
  if (!supabaseClient) return;

  const firebaseJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!firebaseJson) return;

  try {
    // Look up applicant's FCM token by email in profiles
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('email', request.email)
      .maybeSingle();

    if (!profile) return;

    const { data: tokens } = await supabaseClient
      .from('notification_tokens')
      .select('fcm_token')
      .eq('user_id', profile.id);

    if (!tokens || tokens.length === 0) return;

    let serviceAccount;
    try {
      serviceAccount = typeof firebaseJson === 'string' ? JSON.parse(firebaseJson) : firebaseJson;
    } catch { return; }

    const accessToken = await getFirebaseAccessToken(serviceAccount);
    if (!accessToken) return;

    const projectId = serviceAccount.project_id;

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
                title: notification.title,
                body: notification.body,
              },
              webpush: {
                fcm_options: { link: notification.link || '/' },
              },
            },
          }),
        });
      } catch (e) {
        console.error('[FCM] Send error:', e);
      }
    }
  } catch (err) {
    console.error('[FCM] Applicant notification error:', err);
  }
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
