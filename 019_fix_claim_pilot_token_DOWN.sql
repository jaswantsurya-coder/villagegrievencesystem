-- ============================================================================
-- 019 DOWN: Rollback to 009 claim_pilot_token and resolve_village
-- ============================================================================

DROP FUNCTION IF EXISTS public.claim_pilot_token(TEXT, TEXT, TEXT, TEXT, DATE, INT, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.claim_pilot_token(
  p_token          TEXT,
  p_user_id        UUID,
  p_name           TEXT DEFAULT NULL,
  p_mobile         TEXT DEFAULT NULL,
  p_gender         TEXT DEFAULT NULL,
  p_dob            DATE DEFAULT NULL,
  p_age            INT DEFAULT NULL,
  p_address        TEXT DEFAULT NULL,
  p_aadhaar_last4  TEXT DEFAULT NULL,
  p_profile_photo_url TEXT DEFAULT NULL,
  p_village_id_override BIGINT DEFAULT NULL,
  p_village_name   TEXT DEFAULT NULL,
  p_district       TEXT DEFAULT NULL,
  p_state          TEXT DEFAULT NULL,
  p_mandal         TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token     public.pilot_tokens;
  v_village   BIGINT;
  v_role      TEXT;
  v_profile   public.profiles;
BEGIN
  PERFORM set_config('app.bypass_profile_role_check', 'true', true);

  SELECT * INTO v_token
  FROM public.pilot_tokens
  WHERE token = p_token AND status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or inactive token');
  END IF;

  IF v_token.expires_at IS NOT NULL AND v_token.expires_at < now() THEN
    UPDATE public.pilot_tokens SET status = 'expired' WHERE id = v_token.id;
    RETURN json_build_object('success', false, 'error', 'Token expired');
  END IF;

  IF NOT v_token.is_reusable AND v_token.uses_count >= v_token.max_uses THEN
    UPDATE public.pilot_tokens SET status = 'used' WHERE id = v_token.id;
    RETURN json_build_object('success', false, 'error', 'Token already used');
  END IF;

  IF p_village_id_override IS NOT NULL THEN
    v_village := p_village_id_override;
  ELSIF p_village_name IS NOT NULL AND trim(p_village_name) != '' THEN
    v_village := public.resolve_village(
      p_village_name,
      COALESCE(p_district, 'Unknown'),
      COALESCE(p_state, 'Unknown'),
      p_user_id
    );
  ELSE
    v_village := v_token.village_id;
  END IF;

  v_role := 'village_admin';

  INSERT INTO public.profiles (
    id, name, phone, mobile, gender, dob, age, address,
    aadhaar_last4, profile_photo_url, village_id,
    role, super_admin_id, organization_id, pilot_id,
    is_onboarded, last_active, state, district, mandal, village_name
  ) VALUES (
    p_user_id,
    COALESCE(p_name, ''),
    p_mobile,
    p_mobile,
    p_gender,
    p_dob,
    p_age,
    p_address,
    p_aadhaar_last4,
    p_profile_photo_url,
    v_village,
    v_role,
    v_token.super_admin_id,
    v_token.organization_id,
    v_token.pilot_id,
    (p_name IS NOT NULL AND p_mobile IS NOT NULL),
    now(),
    p_state,
    p_district,
    p_mandal,
    p_village_name
  )
  ON CONFLICT (id) DO UPDATE SET
    name              = COALESCE(NULLIF(EXCLUDED.name, ''), profiles.name),
    phone             = COALESCE(EXCLUDED.phone, profiles.phone),
    mobile            = COALESCE(EXCLUDED.mobile, profiles.mobile),
    gender            = COALESCE(EXCLUDED.gender, profiles.gender),
    dob               = COALESCE(EXCLUDED.dob, profiles.dob),
    age               = COALESCE(EXCLUDED.age, profiles.age),
    address           = COALESCE(EXCLUDED.address, profiles.address),
    aadhaar_last4     = COALESCE(EXCLUDED.aadhaar_last4, profiles.aadhaar_last4),
    profile_photo_url = COALESCE(EXCLUDED.profile_photo_url, profiles.profile_photo_url),
    village_id        = COALESCE(EXCLUDED.village_id, profiles.village_id),
    role              = EXCLUDED.role,
    super_admin_id    = COALESCE(EXCLUDED.super_admin_id, profiles.super_admin_id),
    organization_id   = COALESCE(EXCLUDED.organization_id, profiles.organization_id),
    pilot_id          = COALESCE(EXCLUDED.pilot_id, profiles.pilot_id),
    is_onboarded      = EXCLUDED.is_onboarded,
    last_active       = now(),
    state             = COALESCE(EXCLUDED.state, profiles.state),
    district          = COALESCE(EXCLUDED.district, profiles.district),
    mandal            = COALESCE(EXCLUDED.mandal, profiles.mandal),
    village_name      = COALESCE(EXCLUDED.village_name, profiles.village_name)
  RETURNING * INTO v_profile;

  UPDATE public.pilot_tokens
  SET uses_count = uses_count + 1,
      status     = CASE
                     WHEN is_reusable THEN 'active'
                     WHEN uses_count + 1 >= max_uses THEN 'used'
                     ELSE 'active'
                   END
  WHERE id = v_token.id;

  RETURN json_build_object(
    'success',    true,
    'profile',    row_to_json(v_profile),
    'village_id', v_village,
    'role',       v_role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pilot_token TO authenticated;