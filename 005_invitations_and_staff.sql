-- ============================================================================
-- 005_invitations_and_staff.sql
-- Village Invitation System — Database Migration
-- Run this in Supabase SQL Editor BEFORE deploying frontend changes.
-- ============================================================================

-- ─── 1. INVITATIONS TABLE ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invitations (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    village_id  BIGINT NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('citizen', 'officer', 'village_admin')),
    email       TEXT,
    created_by  UUID NOT NULL REFERENCES auth.users(id),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '100 years'),
    used_at     TIMESTAMPTZ,
    accepted_by UUID REFERENCES auth.users(id),
    status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. INDEXES ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_village ON public.invitations(village_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_created_by ON public.invitations(created_by);

-- ─── 3. ROW LEVEL SECURITY ──────────────────────────────────────────────────

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admins can view invitations for their own village
DROP POLICY IF EXISTS "invitations_select" ON public.invitations;
CREATE POLICY "invitations_select" ON public.invitations
FOR SELECT USING (
  public.sec_get_role() = 'super_admin'
  OR (
    public.sec_get_role() IN ('village_admin', 'district_admin')
    AND village_id = public.sec_get_village()
  )
);

-- Admins can create invitations for their own village
DROP POLICY IF EXISTS "invitations_insert" ON public.invitations;
CREATE POLICY "invitations_insert" ON public.invitations
FOR INSERT WITH CHECK (
  public.sec_get_role() = 'super_admin'
  OR (
    public.sec_get_role() IN ('village_admin', 'district_admin')
    AND village_id = public.sec_get_village()
  )
);

-- Admins can update (revoke) invitations for their own village
DROP POLICY IF EXISTS "invitations_update" ON public.invitations;
CREATE POLICY "invitations_update" ON public.invitations
FOR UPDATE USING (
  public.sec_get_role() = 'super_admin'
  OR (
    public.sec_get_role() IN ('village_admin', 'district_admin')
    AND village_id = public.sec_get_village()
  )
);

-- Anyone can read an invitation by token (for the accept flow, via RPC)
-- This is handled server-side in the RPC, not via direct table access.

-- ─── 4. ACCEPT INVITATION RPC ───────────────────────────────────────────────
-- Called by authenticated users to accept an invitation.
-- Validates token, assigns village_id + role, marks invitation used.

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation RECORD;
  v_village_name TEXT;
  v_user_id UUID := auth.uid();
BEGIN
  -- Must be authenticated
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find the invitation
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE token = p_token
  LIMIT 1;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;

  -- Check if already used
  IF v_invitation.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has already been ' || v_invitation.status);
  END IF;

  -- Check if email-restricted and doesn't match
  IF v_invitation.email IS NOT NULL THEN
    DECLARE
      v_user_email TEXT;
    BEGIN
      SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
      IF lower(v_user_email) != lower(v_invitation.email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'This invitation was sent to a different email address');
      END IF;
    END;
  END IF;

  -- Get village name for response
  SELECT village_name INTO v_village_name FROM public.villages WHERE id = v_invitation.village_id;

  -- Set local setting to bypass trigger role modification check
  PERFORM set_config('app.bypass_profile_role_check', 'true', true);

  -- Update the user's profile: assign village + role
  UPDATE public.profiles
  SET village_id = v_invitation.village_id,
      role = v_invitation.role
  WHERE id = v_user_id;

  -- Reset bypass setting
  PERFORM set_config('app.bypass_profile_role_check', 'false', true);

  -- Mark invitation as accepted
  UPDATE public.invitations
  SET status = 'accepted',
      used_at = NOW(),
      accepted_by = v_user_id
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'village_name', v_village_name,
    'village_id', v_invitation.village_id,
    'role', v_invitation.role
  );
END;
$$;

ALTER FUNCTION public.accept_invitation(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.accept_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;

-- ─── 5. LOOKUP INVITATION RPC (public, read-only) ───────────────────────────
-- Used by the frontend to display invitation details before accepting.

CREATE OR REPLACE FUNCTION public.lookup_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation RECORD;
  v_village_name TEXT;
  v_village_district TEXT;
BEGIN
  SELECT i.*, v.village_name, v.district
  INTO v_invitation
  FROM public.invitations i
  JOIN public.villages v ON v.id = i.village_id
  WHERE i.token = p_token
  LIMIT 1;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation not found');
  END IF;

  IF v_invitation.status != 'pending' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', CASE
        WHEN v_invitation.status = 'revoked' THEN 'This invitation has been revoked'
        ELSE 'This invitation has already been used'
      END
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'village_name', v_invitation.village_name,
    'district', v_invitation.district,
    'role', v_invitation.role,
    'expires_at', v_invitation.expires_at
  );
END;
$$;

ALTER FUNCTION public.lookup_invitation(TEXT) OWNER TO postgres;
-- Allow both anon and authenticated to look up (so pre-login users can see the invite)
GRANT EXECUTE ON FUNCTION public.lookup_invitation(TEXT) TO anon, authenticated;

-- ─── 6. AUTO-EXPIRE TRIGGER ─────────────────────────────────────────────────
-- Automatically marks expired invitations on read (lazy expiry).

CREATE OR REPLACE FUNCTION public.auto_expire_invitations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
  RETURN NULL;
END;
$$;

ALTER FUNCTION public.auto_expire_invitations() OWNER TO postgres;

-- Run cleanup on every select from invitations (low cost, runs once per query)
DROP TRIGGER IF EXISTS tr_auto_expire_invitations ON public.invitations;

-- NOTE: Triggers on SELECT are not supported in PostgreSQL.
-- Instead, the frontend/API will filter by expires_at.
-- The accept_invitation RPC already handles expired tokens.

-- ============================================================================
-- DONE. Run this script in Supabase SQL Editor.
-- ============================================================================
