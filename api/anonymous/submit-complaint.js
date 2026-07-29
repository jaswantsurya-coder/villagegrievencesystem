import { createClient } from '@supabase/supabase-js';

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
    const {
      anonymous_user_id,
      title,
      description,
      category,
      priority,
      location,
      latitude,
      longitude,
      photo_urls,
      village_id,
      related_scheme,
    } = req.body;

    // ─── Validate anonymous user ────────────────────────────────────
    if (!anonymous_user_id) {
      return res.status(400).json({ error: 'Anonymous user ID is required. Please verify your phone first.' });
    }

    const { data: anonUser, error: userErr } = await supabase
      .from('anonymous_users')
      .select('*')
      .eq('id', anonymous_user_id)
      .maybeSingle();

    if (userErr || !anonUser) {
      return res.status(404).json({ error: 'Anonymous user not found. Please start the verification process again.' });
    }

    if (!anonUser.is_verified) {
      return res.status(403).json({ error: 'Phone number not verified. Please complete OTP verification first.' });
    }

    // ─── Rate limit: max 3 complaints per day per phone ─────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: todayCount } = await supabase
      .from('anonymous_complaint_link')
      .select('id', { count: 'exact', head: true })
      .eq('anonymous_user_id', anonymous_user_id)
      .gte('created_at', todayStart.toISOString());

    const maxPerDay = parseInt(process.env.ANONYMOUS_MAX_COMPLAINTS_PER_DAY || '3');
    if (todayCount && todayCount >= maxPerDay) {
      return res.status(429).json({
        error: `Maximum ${maxPerDay} anonymous complaints per day. Please try again tomorrow.`,
      });
    }

    // ─── Validate required fields ───────────────────────────────────
    if (!title || title.trim().length < 5) {
      return res.status(400).json({ error: 'Complaint title must be at least 5 characters' });
    }
    if (!description || description.trim().length < 10) {
      return res.status(400).json({ error: 'Description must be at least 10 characters' });
    }

    // ─── Submit complaint via existing RPC ──────────────────────────
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('svc_create_complaint', {
      p_title: title.trim(),
      p_description: description.trim(),
      p_category: category || 'Other',
      p_location: location || null,
      p_latitude: latitude || null,
      p_longitude: longitude || null,
      p_photos: '[]',
      p_photo_urls: JSON.stringify(photo_urls || []),
      p_related_scheme: related_scheme || null,
      p_is_anonymous: true,
      p_anonymous_phone: anonUser.phone,
      p_village_id: village_id || anonUser.village_id || null,
    });

    if (rpcErr) {
      console.error('[submit-complaint] RPC error:', rpcErr);
      return res.status(500).json({ error: `Complaint submission failed: ${rpcErr.message}` });
    }

    const parsed = typeof rpcResult === 'string' ? JSON.parse(rpcResult) : rpcResult;

    if (!parsed?.success) {
      return res.status(400).json({ error: parsed?.error || 'Complaint submission failed' });
    }

    const complaintId = parsed.complaint_id || parsed.id;
    const ticketId = parsed.ticket_id;

    // ─── Link complaint to anonymous user ───────────────────────────
    if (complaintId) {
      await supabase
        .from('anonymous_complaint_link')
        .insert({
          anonymous_user_id: anonymous_user_id,
          complaint_id: complaintId,
        });

      // Update anonymous_user_id on the complaint
      await supabase
        .from('complaints')
        .update({ anonymous_user_id: anonymous_user_id })
        .eq('id', complaintId);

      // Update complaint count
      await supabase
        .from('anonymous_users')
        .update({
          complaint_count: (anonUser.complaint_count || 0) + 1,
          last_complaint_at: new Date().toISOString(),
          village_id: village_id || anonUser.village_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', anonymous_user_id);
    }

    return res.status(200).json({
      success: true,
      message: 'Complaint submitted successfully',
      complaint_id: complaintId,
      ticket_id: ticketId,
      anonymous_id: anonUser.anonymous_id,
    });
  } catch (err) {
    console.error('[submit-complaint] Error:', err);
    return res.status(500).json({ error: 'Complaint submission failed' });
  }
}
