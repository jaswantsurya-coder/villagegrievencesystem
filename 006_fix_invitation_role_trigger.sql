-- ============================================================================
-- GramSeva — 006_fix_invitation_role_trigger.sql
-- Fixes role modification checks when accepting village invitation tokens.
-- Run this in your Supabase SQL Editor to apply this hotfix.
-- ============================================================================

-- 1. Update the check_profile_update trigger function to bypass checks when bypass is enabled.
CREATE OR REPLACE FUNCTION public.check_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Bypass role check if explicitly set by session configuration (e.g. from accept_invitation)
  IF current_setting('app.bypass_profile_role_check', true) = 'true' THEN
     RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL
     AND NEW.id = auth.uid()
     AND NEW.role IS DISTINCT FROM OLD.role
  THEN
     RAISE EXCEPTION 'Cannot modify your own role';
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.check_profile_update() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.check_profile_update() TO authenticated, service_role;

-- 2. Update accept_invitation RPC to temporarily set the bypass session setting.
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
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;
