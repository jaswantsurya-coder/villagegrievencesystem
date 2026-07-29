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
    const { village_name, district } = req.body;

    if (!village_name || !district) {
      return res.status(400).json({ error: 'Village name and district are required' });
    }

    // Use the RPC function we created in the migration
    const { data, error } = await supabase.rpc('svc_verify_village_admin_exists', {
      p_village_name: village_name.trim(),
      p_district: district.trim(),
    });

    if (error) {
      console.error('[validate-village] RPC error:', error);
      return res.status(500).json({ error: 'Village validation failed' });
    }

    const result = typeof data === 'string' ? JSON.parse(data) : data;

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('[validate-village] Error:', err);
    return res.status(500).json({ error: 'Village validation failed' });
  }
}
