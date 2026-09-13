import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

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
          email: process.env.BREVO_SENDER_EMAIL || 'gramseva0089@gmail.com',
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

    if (!res.ok) {
      const errorBody = await res.text();
      return { success: false, error: `Brevo HTTP ${res.status}: ${errorBody}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Determine action from query or URL
  const action = req.query.action || (req.url.includes('send-otp') ? 'send-otp' : req.url.includes('verify-otp') ? 'verify-otp' : req.url.includes('validate-village') ? 'validate-village' : req.url.includes('submit-complaint') ? 'submit-complaint' : 'send-otp');

  // 1. ACTION: SEND-OTP
  if (action === 'send-otp') {
    try {
      const { phone, email } = req.body || {};
      if (!phone || phone.length < 10) return res.status(400).json({ error: 'Valid phone number is required' });
      if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email is required for OTP delivery' });

      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { count: recentCount } = await supabase
        .from('anonymous_users')
        .select('id', { count: 'exact', head: true })
        .eq('phone', cleanPhone)
        .gte('updated_at', oneHourAgo);

      if (recentCount && recentCount >= 5) {
        return res.status(429).json({ error: 'Too many OTP requests. Please try again after 1 hour.' });
      }

      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { data: existing } = await supabase
        .from('anonymous_users')
        .select('id, anonymous_id, otp_attempts')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (existing) {
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
        const { data: anonId } = await supabase.rpc('svc_generate_anonymous_id');
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

      const emailResult = await sendOTPEmail(email, otp);
      if (!emailResult.success) {
        return res.status(500).json({ error: 'Failed to send OTP email. Please verify your email address.', details: emailResult.error });
      }

      return res.status(200).json({
        success: true,
        message: `OTP sent to ${email}`,
        channel: 'email',
        phone: cleanPhone,
      });
    } catch (err) {
      console.error('[anonymous send-otp]:', err);
      return res.status(500).json({ error: 'Failed to send OTP' });
    }
  }

  // 2. ACTION: VERIFY-OTP
  if (action === 'verify-otp') {
    try {
      const { phone, otp } = req.body || {};
      if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP are required' });

      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      const { data: user, error: fetchErr } = await supabase
        .from('anonymous_users')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (fetchErr || !user) return res.status(404).json({ error: 'No OTP request found for this phone number. Please request a new OTP.' });
      if (user.otp_attempts >= 3) return res.status(429).json({ error: 'Maximum verification attempts reached. Please request a new OTP.', max_attempts_reached: true });
      if (new Date(user.otp_expires_at) < new Date()) return res.status(410).json({ error: 'OTP has expired. Please request a new one.', expired: true });

      await supabase.from('anonymous_users').update({ otp_attempts: (user.otp_attempts || 0) + 1 }).eq('id', user.id);
      const inputHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');

      if (inputHash !== user.otp_hash) {
        const attemptsLeft = 2 - (user.otp_attempts || 0);
        return res.status(401).json({
          error: `Invalid OTP. ${attemptsLeft > 0 ? `${attemptsLeft} attempt(s) remaining.` : 'Please request a new OTP.'}`,
          attempts_remaining: Math.max(0, attemptsLeft),
        });
      }

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
      console.error('[anonymous verify-otp]:', err);
      return res.status(500).json({ error: 'Verification failed' });
    }
  }

  // 3. ACTION: VALIDATE-VILLAGE
  if (action === 'validate-village') {
    try {
      const { village_name, district } = req.body || {};
      if (!village_name || !district) return res.status(400).json({ error: 'Village name and district are required' });

      const { data, error } = await supabase.rpc('svc_verify_village_admin_exists', {
        p_village_name: village_name.trim(),
        p_district: district.trim(),
      });

      if (error) return res.status(500).json({ error: 'Village validation failed' });
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error('[anonymous validate-village]:', err);
      return res.status(500).json({ error: 'Village validation failed' });
    }
  }

  // 4. ACTION: SUBMIT-COMPLAINT
  if (action === 'submit-complaint') {
    try {
      const { anonymous_user_id, title, description, category, priority, location, latitude, longitude, photo_urls, village_id, related_scheme } = req.body || {};

      if (!anonymous_user_id) return res.status(400).json({ error: 'Anonymous user ID is required. Please verify your phone first.' });

      const { data: anonUser } = await supabase.from('anonymous_users').select('*').eq('id', anonymous_user_id).maybeSingle();
      if (!anonUser) return res.status(404).json({ error: 'Anonymous user not found. Please start the verification process again.' });
      if (!anonUser.is_verified) return res.status(403).json({ error: 'Phone number not verified. Please complete OTP verification first.' });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count: todayCount } = await supabase
        .from('anonymous_complaint_link')
        .select('id', { count: 'exact', head: true })
        .eq('anonymous_user_id', anonymous_user_id)
        .gte('created_at', todayStart.toISOString());

      const maxPerDay = parseInt(process.env.ANONYMOUS_MAX_COMPLAINTS_PER_DAY || '3');
      if (todayCount && todayCount >= maxPerDay) {
        return res.status(429).json({ error: `Maximum ${maxPerDay} anonymous complaints per day. Please try again tomorrow.` });
      }

      if (!title || title.trim().length < 5) return res.status(400).json({ error: 'Complaint title must be at least 5 characters' });
      if (!description || description.trim().length < 10) return res.status(400).json({ error: 'Description must be at least 10 characters' });

      const { data: rpcResult, error: rpcErr } = await supabase.rpc('svc_create_complaint', {
        p_title: title.trim(),
        p_description: description.trim(),
        p_category: category || 'Other',
        p_location: location || null,
        p_latitude: latitude || null,
        p_longitude: longitude || null,
        p_photos: [],
        p_photo_urls: photo_urls || [],
        p_related_scheme: related_scheme || null,
        p_is_anonymous: true,
        p_anonymous_phone: anonUser.phone,
        p_village_id: village_id || anonUser.village_id || null,
      });

      if (rpcErr) return res.status(500).json({ error: `Complaint submission failed: ${rpcErr.message}` });
      const parsed = typeof rpcResult === 'string' ? JSON.parse(rpcResult) : rpcResult;
      if (!parsed?.success) return res.status(400).json({ error: parsed?.error || 'Complaint submission failed' });

      const complaintId = parsed.complaint_id || parsed.id;
      const ticketId = parsed.ticket_id;

      if (complaintId) {
        await supabase.from('anonymous_complaint_link').insert({ anonymous_user_id, complaint_id: complaintId });
        await supabase.from('complaints').update({ anonymous_user_id }).eq('id', complaintId);
        await supabase.from('anonymous_users').update({
          complaint_count: (anonUser.complaint_count || 0) + 1,
          last_complaint_at: new Date().toISOString(),
          village_id: village_id || anonUser.village_id,
          updated_at: new Date().toISOString(),
        }).eq('id', anonymous_user_id);

        // ─── Phase 3: Fire-and-forget AI enqueue (non-blocking) ─────
        // Complaint is already saved. If this fails, the self-healing
        // scanner on the Oracle worker will pick it up later.
        const apiBase = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : process.env.API_BASE_URL || '';
        if (apiBase) {
          fetch(`${apiBase}/api/nlp?action=enqueue-ai`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
            },
            body: JSON.stringify({
              complaint_id: complaintId,
              text: description.trim(),
              image_urls: photo_urls || [],
              latitude: latitude || null,
              longitude: longitude || null,
              village_id: village_id || anonUser.village_id || null,
            }),
          }).catch(err => console.error('[anonymous enqueue-ai failed]:', err.message));
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Complaint submitted successfully',
        complaint_id: complaintId,
        ticket_id: ticketId,
        anonymous_id: anonUser.anonymous_id,
      });
    } catch (err) {
      console.error('[anonymous submit-complaint]:', err);
      return res.status(500).json({ error: 'Complaint submission failed' });
    }
  }

  return res.status(400).json({ error: 'Invalid action requested' });
}
