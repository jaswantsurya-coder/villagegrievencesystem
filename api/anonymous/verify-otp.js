import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP are required' });
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    // ─── Find the anonymous user ────────────────────────────────────
    const { data: user, error: fetchErr } = await supabase
      .from('anonymous_users')
      .select('*')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (fetchErr || !user) {
      return res.status(404).json({ error: 'No OTP request found for this phone number. Please request a new OTP.' });
    }

    // ─── Check attempt limit (max 3) ────────────────────────────────
    if (user.otp_attempts >= 3) {
      return res.status(429).json({
        error: 'Maximum verification attempts reached. Please request a new OTP.',
        max_attempts_reached: true,
      });
    }

    // ─── Check expiry ───────────────────────────────────────────────
    if (new Date(user.otp_expires_at) < new Date()) {
      return res.status(410).json({
        error: 'OTP has expired. Please request a new one.',
        expired: true,
      });
    }

    // ─── Increment attempt counter ──────────────────────────────────
    await supabase
      .from('anonymous_users')
      .update({ otp_attempts: (user.otp_attempts || 0) + 1 })
      .eq('id', user.id);

    // ─── Verify OTP hash ────────────────────────────────────────────
    const inputHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');

    if (inputHash !== user.otp_hash) {
      const attemptsLeft = 2 - (user.otp_attempts || 0);
      return res.status(401).json({
        error: `Invalid OTP. ${attemptsLeft > 0 ? `${attemptsLeft} attempt(s) remaining.` : 'Please request a new OTP.'}`,
        attempts_remaining: Math.max(0, attemptsLeft),
      });
    }

    // ─── OTP verified successfully ──────────────────────────────────
    await supabase
      .from('anonymous_users')
      .update({
        is_verified: true,
        otp_hash: null,
        otp_expires_at: null,
        otp_attempts: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    return res.status(200).json({
      success: true,
      message: 'Phone number verified successfully',
      anonymous_user_id: user.id,
      anonymous_id: user.anonymous_id,
      phone: cleanPhone,
    });
  } catch (err) {
    console.error('[verify-otp] Error:', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
}
