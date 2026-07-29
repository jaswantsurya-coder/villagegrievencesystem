import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ─── Supabase Admin Client ──────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ─── Brevo Email Helper ─────────────────────────────────────────────────────
async function sendOTPEmail(email, otp) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY || !email) return { success: false, error: 'No email or API key' };

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: process.env.BREVO_SENDER_NAME || 'GramSeva',
          email: process.env.BREVO_SENDER_EMAIL || 'admin@gramseva.in',
        },
        to: [{ email }],
        subject: `[GramSeva] Your OTP Code: ${otp}`,
        htmlContent: `
          <div style="font-family:'Inter',Arial,sans-serif;max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <div style="background:#0284c7;padding:20px;text-align:center;">
              <h2 style="margin:0;color:#fff;font-size:18px;">🔐 GramSeva OTP Verification</h2>
            </div>
            <div style="padding:24px;text-align:center;">
              <p style="color:#475569;font-size:14px;margin:0 0 16px;">Your one-time verification code is:</p>
              <div style="background:#f0f9ff;border:2px dashed #0284c7;border-radius:12px;padding:20px;margin:0 auto;max-width:200px;">
                <span style="font-size:32px;font-weight:900;letter-spacing:8px;color:#0284c7;">${otp}</span>
              </div>
              <p style="color:#94a3b8;font-size:12px;margin:16px 0 0;">Valid for 10 minutes. Do not share this code.</p>
            </div>
            <div style="background:#f8fafc;padding:12px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:11px;">GramSeva — Digital Gram Panchayat</p>
            </div>
          </div>
        `,
      }),
    });
    return { success: res.ok };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, email } = req.body;

    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    // ─── Rate limit: max 5 OTP requests per phone per hour ──────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from('anonymous_users')
      .select('id', { count: 'exact', head: true })
      .eq('phone', cleanPhone)
      .gte('updated_at', oneHourAgo);

    if (recentCount && recentCount >= 5) {
      return res.status(429).json({
        error: 'Too many OTP requests. Please try again after 1 hour.',
      });
    }

    // ─── Generate 6-digit OTP ───────────────────────────────────────
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // ─── Check if anonymous user already exists ─────────────────────
    const { data: existing } = await supabase
      .from('anonymous_users')
      .select('id, anonymous_id, otp_attempts')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (existing) {
      // Update existing record with new OTP
      await supabase
        .from('anonymous_users')
        .update({
          otp_hash: otpHash,
          otp_expires_at: otpExpiresAt,
          otp_attempts: 0,
          email: email || existing.email || null,
          is_verified: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Generate anonymous ID via RPC
      const { data: anonId } = await supabase.rpc('svc_generate_anonymous_id');

      // Create new anonymous user
      await supabase
        .from('anonymous_users')
        .insert({
          anonymous_id: anonId,
          phone: cleanPhone,
          email: email || null,
          otp_hash: otpHash,
          otp_expires_at: otpExpiresAt,
          otp_attempts: 0,
          is_verified: false,
        });
    }

    // ─── Send OTP via Email (if email provided) ─────────────────────
    let otpSent = false;
    let sendChannel = 'none';

    if (email) {
      const emailResult = await sendOTPEmail(email, otp);
      if (emailResult.success) {
        otpSent = true;
        sendChannel = 'email';
      }
    }

    // In development/testing, also log OTP to console
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Anonymous OTP] Phone: ${cleanPhone}, OTP: ${otp}`);
    }

    return res.status(200).json({
      success: true,
      message: otpSent
        ? `OTP sent to ${email}`
        : 'OTP generated. Please check your registered contact.',
      channel: sendChannel,
      phone: cleanPhone,
      // In dev mode, include OTP for testing
      ...(process.env.NODE_ENV !== 'production' && { dev_otp: otp }),
    });
  } catch (err) {
    console.error('[send-otp] Error:', err);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
}
