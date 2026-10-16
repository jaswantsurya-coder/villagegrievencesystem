-- ============================================================================
-- 025_simplify_officer_invitations_DOWN.sql
-- Rollback for 025_simplify_officer_invitations.sql
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.generate_officer_invitation();
DROP FUNCTION IF EXISTS public.generate_citizen_invitation();
DROP FUNCTION IF EXISTS public.revoke_invitation(UUID);
DROP FUNCTION IF EXISTS public.accept_invitation(TEXT, TEXT, TEXT, TEXT);

-- Restore original accept_invitation(p_token TEXT) from 024
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

  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < NOW() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has expired');
  END IF;

  SELECT village_name INTO v_village_name FROM public.villages WHERE id = v_invitation.village_id;

  PERFORM set_config('app.bypass_profile_role_check', 'true', true);

  INSERT INTO public.profiles (id, village_id, role, department, name, phone)
  VALUES (
    v_user_id, 
    v_invitation.village_id, 
    v_invitation.role, 
    v_invitation.department, 
    COALESCE(v_invitation.name, 'Staff Member'), 
    v_invitation.phone
  )
  ON CONFLICT (id) DO UPDATE
  SET village_id = EXCLUDED.village_id,
      role = EXCLUDED.role,
      department = COALESCE(EXCLUDED.department, public.profiles.department),
      name = COALESCE(EXCLUDED.name, public.profiles.name),
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

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

COMMIT;
