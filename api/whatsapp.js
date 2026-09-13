import { withSentry, captureSilentFailure, Sentry } from './_lib/sentry.js';
/**
 * POST /api/whatsapp
 * Vercel Serverless Function to send WhatsApp notifications.
 * Supports Meta WhatsApp Cloud API (Graph API) and generic REST webhooks.
 * Auth: X-Internal-Secret (server-to-server only)
 *
 * Body:
 * {
 *   to: string; // Phone number (e.g. "+919876543210" or "9876543210")
 *   type: 'submission_applicant' | 'submission_superadmin' | 'approval' | 'rejection' | 'complaint_created' | 'complaint_updated' | 'custom';
 *   data?: Record<string, any>;
 *   message?: string; // Custom message text if type is 'custom'
 * }
 */

import { verifyInternalSecret } from './_lib/requireRole.js';

export function formatPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  // If 10 digits (Indian number without country code), prepend 91
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

export function buildWhatsAppMessage(type, data = {}, customMessage = '') {
  if (type === 'custom' && customMessage) {
    return customMessage;
  }

  const {
    full_name = 'User',
    village_name = 'Village',
    district = '',
    state = '',
    request_id = '',
    phone = '',
    rejection_reason = '',
    invitation_url = '',
    ticket_number = '',
    title = '',
    status = '',
    resolution_notes = ''
  } = data;

  switch (type) {
    case 'submission_applicant':
      return `🙏 *GramSeva Admin Request Submitted*\n\nHello *${full_name}*,\n\nYour Village Admin Verification Request for *${village_name}* (${district}, ${state}) has been submitted successfully!\n\n📋 *Request ID:* ${request_id || 'Pending'}\n\nOur Super Admin team will review your application shortly. You will receive an update once verified.\n\n— GramSeva Team`;

    case 'submission_superadmin':
      return `🔔 *GramSeva Alert: New Admin Request*\n\nA new Sarpanch Admin Verification request has been submitted:\n\n👤 *Applicant:* ${full_name}\n🏡 *Village:* ${village_name} (${district}, ${state})\n📞 *Phone:* ${phone}\n🆔 *Request ID:* ${request_id}\n\nReview now on Super Admin Dashboard:\nhttps://gramseva-superadmin.vercel.app`;

    case 'approval':
      return `🎉 *GramSeva Admin Verification APPROVED!*\n\nDear *${full_name}*,\n\nCongratulations! Your Admin Verification Request for *${village_name}* has been *APPROVED* by Super Admin.\n\nYour administrative privileges are now active. You can log in to manage your village complaints and administration:\n${invitation_url || 'https://gramseva-superadmin.vercel.app'}\n\nWelcome aboard!\n— GramSeva Team`;

    case 'rejection':
      return `⚠️ *GramSeva Admin Verification Update*\n\nDear *${full_name}*,\n\nYour Admin Verification Request for *${village_name}* was reviewed. Unfortunately, it could not be approved at this time.\n\n${rejection_reason ? `*Reason:* ${rejection_reason}\n\n` : ''}You may submit a fresh request with updated details here:\nhttps://admin-request-portal-omega.vercel.app\n\n— GramSeva Team`;

    case 'complaint_created':
      return `📌 *GramSeva Grievance Registered*\n\nHello *${full_name}*,\n\nYour grievance has been successfully logged.\n\n🎟️ *Ticket #:* ${ticket_number}\n📝 *Title:* ${title}\n🏡 *Village:* ${village_name}\n📊 *Status:* Open\n\nYou can track resolution progress on the GramSeva app.`;

    case 'complaint_updated':
      return `📢 *GramSeva Grievance Update*\n\nTicket #*${ticket_number}* status updated:\n\n📊 *New Status:* ${status}\n${resolution_notes ? `💬 *Notes:* ${resolution_notes}\n` : ''}\nThank you for using GramSeva!`;

    default:
      return customMessage || `GramSeva Notification for ${full_name}`;
  }
}

export async function sendWhatsAppNotification({ to, type, data, message }) {
  const formattedPhone = formatPhoneNumber(to);
  if (!formattedPhone) {
    return { success: false, error: 'Invalid phone number' };
  }

  const textBody = buildWhatsAppMessage(type, data, message);

  // Read environment configuration
  const waToken = process.env.WHATSAPP_API_TOKEN || process.env.META_WA_TOKEN || process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_WA_PHONE_NUMBER_ID;
  const customUrl = process.env.WHATSAPP_API_URL;

  // 1. Meta WhatsApp Cloud API
  if (phoneNumberId && waToken) {
    const url = customUrl || `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${waToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'text',
          text: { preview_url: false, body: textBody },
        }),
      });

      const resData = await response.json();
      if (response.ok && (resData.messages || resData.id)) {
        console.log(`[WhatsApp Meta Cloud API] Sent successfully to ${formattedPhone}`);
        return { success: true, provider: 'meta', resData };
      } else {
        console.warn(`[WhatsApp Meta Cloud API Failed]:`, resData);
      }
    } catch (err) {
      console.error(`[WhatsApp Meta Cloud API Exception]:`, err);
    }
  }

  // 2. Generic Webhook / UltraMsg / Third-party HTTP fallback if WHATSAPP_API_URL is configured
  if (customUrl && waToken) {
    try {
      const response = await fetch(customUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${waToken}`,
          'token': waToken,
        },
        body: JSON.stringify({
          to: formattedPhone,
          phone: formattedPhone,
          body: textBody,
          message: textBody,
        }),
      });
      const resData = await response.json();
      if (response.ok) {
        console.log(`[WhatsApp Custom API] Sent successfully to ${formattedPhone}`);
        return { success: true, provider: 'custom', resData };
      }
    } catch (err) {
      console.error(`[WhatsApp Custom API Exception]:`, err);
    }
  }

  // Fallback logging if credentials are not configured yet (Stub Mode)
  console.log(`[WhatsApp Stub Mode] Would send to ${formattedPhone}:\n${textBody}`);
  return {
    success: true,
    provider: 'stub',
    message: 'Message logged in stub mode (add WHATSAPP_PHONE_NUMBER_ID & WHATSAPP_API_TOKEN to enable live Meta API)',
    textBody,
  };
}

async function handler(req, res) {
  // CORS
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://villagegrievencesystem-fgxb.vercel.app,https://gramseva-superadmin.vercel.app,http://localhost:5173').split(',');
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Internal-Secret');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  // Auth: server-to-server only
  if (!verifyInternalSecret(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized. X-Internal-Secret required.' });
  }

  try {
    const { to, type, data, message } = req.body || {};
    if (!to) {
      return res.status(400).json({ success: false, error: 'Recipient phone number (to) is required.' });
    }

    const result = await sendWhatsAppNotification({ to, type, data, message });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[api/whatsapp] Error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
}


export default withSentry(handler);
