import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/delete-complaint
 * Server-side handler for deleting complaints from the auxiliary Supabase.
 * Uses service role key to bypass RLS — ensures deletion propagates
 * to all apps (citizen, village admin, super admin) since they share the same DB.
 *
 * Body: { complaintId: UUID }
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

  // Verify auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Bearer token required.' });
  }

  const token = authHeader.replace('Bearer ', '');

  // Primary Supabase — verify the Super Admin's JWT
  const primaryUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://sompzqwvegygtpsrlhzt.supabase.co';
  const primaryServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!primaryServiceKey) {
    return res.status(500).json({ success: false, error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY.' });
  }

  const primaryAdmin = createClient(primaryUrl, primaryServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify caller is authenticated
  const { data: { user }, error: authError } = await primaryAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }

  // Parse body
  const { complaintId } = req.body || {};
  if (!complaintId) {
    return res.status(400).json({ success: false, error: 'complaintId is required.' });
  }

  // Auxiliary Supabase — service role to bypass RLS and delete
  const auxUrl = process.env.SUPABASE_AUX_URL || process.env.VITE_SUPABASE_AUX_URL || 'https://dtucrczgagpzjbbrwqit.supabase.co';
  const auxServiceKey = process.env.SUPABASE_AUX_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  const auxAdmin = createClient(auxUrl, auxServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // First fetch the complaint to confirm it exists
    const { data: complaint, error: fetchError } = await auxAdmin
      .from('complaints')
      .select('id, title, ticket_number, citizen_id, village_id')
      .eq('id', complaintId)
      .single();

    if (fetchError || !complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found.' });
    }

    // Delete the complaint — this removes it from the shared DB,
    // so it disappears from citizen app, village admin, and super admin simultaneously
    const { error: deleteError } = await auxAdmin
      .from('complaints')
      .delete()
      .eq('id', complaintId);

    if (deleteError) {
      console.error('[delete-complaint] Delete failed:', deleteError);
      return res.status(500).json({ success: false, error: 'Failed to delete: ' + deleteError.message });
    }

    // Log the deletion in the primary Supabase notifications (optional audit trail)
    try {
      await primaryAdmin.from('sa_notifications').insert({
        type: 'system',
        title: 'Complaint Deleted',
        message: `Complaint ${complaint.ticket_number || complaint.id} "${complaint.title || 'General Grievance'}" was permanently deleted by Super Admin.`,
        icon: 'x-circle',
        link_path: '/complaints',
      });
    } catch (notifErr) {
      // Non-critical, just log
      console.warn('[delete-complaint] Notification insert failed:', notifErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Complaint deleted successfully across all platforms.',
      deletedId: complaintId,
    });
  } catch (err) {
    console.error('[delete-complaint] Unexpected error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}
