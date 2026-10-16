-- ============================================================================
-- 025_simplify_officer_invitations.sql
-- GramSeva — Simplified Officer Link Generation & Officer Self-Registration
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 1. SECURE RPC: GENERATE OFFICER INVITATION LINK IMMEDIATELY ────────────
-- Generates a cryptographically random officer invitation token bound to the
-- authenticated admin's village WITHOUT requiring any officer details upfront.

CREATE OR REPLACE FUNCTION public.generate_officer_invitation()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
  v_caller_village BIGINT;
  v_token TEXT;
  v_expires_at TIMESTAMPTZ := NOW() + INTERVAL '30 days';
  v_invitation_id UUID;
  v_village_name TEXT;
  v_district TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  v_caller_role := public.sec_get_role();
  v_caller_village := public.sec_get_village();

  IF v_caller_role NOT IN ('village_admin', 'district_admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only village administrators can generate officer links');
  END IF;

  IF v_caller_village IS NULL AND v_caller_role = 'village_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin account is not assigned to any village');
  END IF;

  -- Generate 64-character hex token (32 random bytes)
  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.invitations (
    token,
    village_id,
    role,
    created_by,
    expires_at,
    status
  ) VALUES (
    v_token,
    v_caller_village,
    'officer',
    v_caller_id,
    v_expires_at,
    'pending'
  ) RETURNING id INTO v_invitation_id;

  SELECT village_name, district INTO v_village_name, v_district 
  FROM public.villages 
  WHERE id = v_caller_village;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_invitation_id,
    'token', v_token,
    'village_id', v_caller_village,
    'village_name', v_village_name,
    'district', v_district,
    'expires_at', v_expires_at,
    'role', 'officer'
  );
END;
$$;
ALTER FUNCTION public.generate_officer_invitation() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.generate_officer_invitation() TO authenticated;

-- ─── 2. SECURE RPC: ACCEPT INVITATION WITH OFFICER SELF-ENTERED DETAILS ──────
-- Allows the officer to provide their own Name, Phone, and Department when accepting.
-- Village ID and Officer Role are strictly retrieved from the server-side invitation record.

DROP FUNCTION IF EXISTS public.accept_invitation(TEXT);
DROP FUNCTION IF EXISTS public.accept_invitation(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_token TEXT,
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_department TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation RECORD;
  v_village_name TEXT;
  v_user_id UUID := auth.uid();
  v_user_email TEXT;
  v_final_name TEXT;
  v_final_phone TEXT;
  v_final_dept TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE token = p_token
  LIMIT 1;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;

  IF v_invitation.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has already been ' || v_invitation.status);
  END IF;

  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < NOW() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has expired');
  END IF;

  -- Verify user email if invitation was explicitly restricted
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF v_invitation.email IS NOT NULL THEN
    IF lower(COALESCE(v_user_email, '')) != lower(v_invitation.email) THEN
      RETURN jsonb_build_object('success', false, 'error', 'This invitation was sent to a different email address');
    END IF;
  END IF;

  SELECT village_name INTO v_village_name FROM public.villages WHERE id = v_invitation.village_id;

  -- Determine final profile fields (officer-provided values take priority over defaults)
  v_final_name := COALESCE(NULLIF(TRIM(p_name), ''), v_invitation.name, 'Officer');
  v_final_phone := COALESCE(NULLIF(TRIM(p_phone), ''), v_invitation.phone);
  v_final_dept := COALESCE(NULLIF(TRIM(p_department), ''), v_invitation.department, 'General Administration');

  -- Bypass trigger role check
  PERFORM set_config('app.bypass_profile_role_check', 'true', true);

  -- Upsert profile with village, role, department, name, phone, email
  INSERT INTO public.profiles (id, village_id, role, department, name, phone, email)
  VALUES (
    v_user_id, 
    v_invitation.village_id, 
    v_invitation.role, 
    v_final_dept, 
    v_final_name, 
    v_final_phone,
    v_user_email
  )
  ON CONFLICT (id) DO UPDATE
  SET village_id = EXCLUDED.village_id,
      role = EXCLUDED.role,
      department = COALESCE(NULLIF(EXCLUDED.department, ''), public.profiles.department),
      name = COALESCE(NULLIF(EXCLUDED.name, 'Officer'), public.profiles.name, EXCLUDED.name),
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
      email = COALESCE(EXCLUDED.email, public.profiles.email);

  PERFORM set_config('app.bypass_profile_role_check', 'false', true);

  -- Mark invitation as accepted so it cannot be reused
  UPDATE public.invitations
  SET status = 'accepted',
      used_at = NOW(),
      accepted_by = v_user_id
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'village_name', v_village_name,
    'village_id', v_invitation.village_id,
    'role', v_invitation.role,
    'department', v_final_dept,
    'name', v_final_name
  );
END;
$$;
ALTER FUNCTION public.accept_invitation(TEXT, TEXT, TEXT, TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ─── 3. SECURE RPC: REVOKE INVITATION BY ADMIN ──────────────────────────────

CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_village BIGINT;
  v_invitation RECORD;
BEGIN
  v_caller_role := public.sec_get_role();
  v_caller_village := public.sec_get_village();

  SELECT * INTO v_invitation FROM public.invitations WHERE id = p_invitation_id;
  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;

  IF v_caller_role != 'super_admin' AND (v_caller_role NOT IN ('village_admin', 'district_admin') OR v_invitation.village_id != v_caller_village) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized to revoke this invitation');
  END IF;

  UPDATE public.invitations
  SET status = 'revoked'
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
ALTER FUNCTION public.revoke_invitation(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.revoke_invitation(UUID) TO authenticated;

COMMIT;
