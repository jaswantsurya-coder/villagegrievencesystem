-- ============================================================================
-- GramSeva — 012_citizen_info_admin_view.sql
-- Complaint Ownership & Citizen Verification — Database Layer
-- ============================================================================

-- ─── 1. Add avatar_url column to profiles (future-ready) ────────────────────
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.profiles.avatar_url IS
  'Optional profile photo URL for citizen identity verification in admin views.';

-- ─── 2. Secure RPC to batch-fetch citizen emails for admin dashboard ────────
-- Email lives in auth.users, not in profiles.
-- This SECURITY DEFINER function safely exposes emails ONLY to authorized roles.
-- The caller's role is checked against profiles.role before returning any data.

CREATE OR REPLACE FUNCTION public.get_citizen_emails(p_citizen_ids UUID[])
RETURNS TABLE(citizen_id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- Verify caller is an admin or officer
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('village_admin', 'district_admin', 'super_admin', 'officer') THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to view citizen emails';
  END IF;

  -- Return emails for the requested citizen IDs
  RETURN QUERY
  SELECT u.id AS citizen_id, u.email
  FROM auth.users u
  WHERE u.id = ANY(p_citizen_ids);
END;
$$;

COMMENT ON FUNCTION public.get_citizen_emails(UUID[]) IS
  'Batch-fetches citizen emails from auth.users. Restricted to admin/officer roles via SECURITY DEFINER.';

-- Grant execute to authenticated users (RPC role check handles authorization)
GRANT EXECUTE ON FUNCTION public.get_citizen_emails(UUID[]) TO authenticated;
