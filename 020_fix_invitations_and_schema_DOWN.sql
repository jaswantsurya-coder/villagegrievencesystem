-- ============================================================================
-- 020 DOWN: Rollback invitations TTL, triggers, and schema changes
-- ============================================================================

-- 1. Revert default expiration
ALTER TABLE public.invitations ALTER COLUMN expires_at DROP DEFAULT;

-- 2. Drop user email sync trigger and function
DROP TRIGGER IF EXISTS on_auth_user_email_sync ON auth.users;
DROP FUNCTION IF EXISTS public.handle_user_email_sync();

-- 3. Restore accept_invitation from 006 (without expiration check)
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

  SELECT village_name INTO v_village_name FROM public.villages WHERE id = v_invitation.village_id;

  PERFORM set_config('app.bypass_profile_role_check', 'true', true);

  INSERT INTO public.profiles (id, village_id, role)
  VALUES (v_user_id, v_invitation.village_id, v_invitation.role)
  ON CONFLICT (id) DO UPDATE
  SET village_id = EXCLUDED.village_id,
      role = EXCLUDED.role;

  PERFORM set_config('app.bypass_profile_role_check', 'false', true);

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
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;

-- 4. Restore lookup_invitation from 005
CREATE OR REPLACE FUNCTION public.lookup_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation RECORD;
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
GRANT EXECUTE ON FUNCTION public.lookup_invitation(TEXT) TO anon, authenticated;