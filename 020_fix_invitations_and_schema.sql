-- ============================================================================
-- 020_fix_invitations_and_schema.sql
-- GramSeva — Fix invitation expiration, profiles email sync, and AI queue type
-- ============================================================================

-- 1. Set invitations default expiration to 14 days
ALTER TABLE public.invitations 
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '14 days');

-- 2. Hardened accept_invitation with expiration enforcement
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

  -- Check if already used or revoked
  IF v_invitation.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has already been ' || v_invitation.status);
  END IF;

  -- Enforce 14-day / explicit expiration check
  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < NOW() THEN
    UPDATE public.invitations 
    SET status = 'expired' 
    WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has expired');
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

  -- Upsert the user's profile: assign village + role
  INSERT INTO public.profiles (id, village_id, role)
  VALUES (v_user_id, v_invitation.village_id, v_invitation.role)
  ON CONFLICT (id) DO UPDATE
  SET village_id = EXCLUDED.village_id,
      role = EXCLUDED.role;

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

-- 3. Update lookup_invitation to also reject expired tokens
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
        WHEN v_invitation.status = 'expired' THEN 'This invitation has expired'
        ELSE 'This invitation has already been used'
      END
    );
  END IF;

  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation has expired');
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

-- 4. Ensure profiles columns exist and backfill email
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Backfill profiles.email from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email != u.email);

-- Trigger to sync email on user insert/update
CREATE OR REPLACE FUNCTION public.handle_user_email_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.handle_user_email_sync() OWNER TO postgres;

DROP TRIGGER IF EXISTS on_auth_user_email_sync ON auth.users;
CREATE TRIGGER on_auth_user_email_sync
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_email_sync();

-- 5. Fix ai_processing_queue.village_id column type mismatch (UUID -> BIGINT)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'ai_processing_queue'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'ai_processing_queue'
        AND column_name = 'village_id'
        AND data_type = 'uuid'
    ) THEN
      ALTER TABLE public.ai_processing_queue DROP COLUMN village_id;
      ALTER TABLE public.ai_processing_queue ADD COLUMN village_id BIGINT REFERENCES public.villages(id) ON DELETE SET NULL;
    ELSIF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'ai_processing_queue'
        AND column_name = 'village_id'
    ) THEN
      ALTER TABLE public.ai_processing_queue ADD COLUMN village_id BIGINT REFERENCES public.villages(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;