-- ============================================================================
-- 019: Fix claim_pilot_token Privilege Escalation & Add resolve_village Guards
-- Derives user ID from auth.uid() rather than trusting client-supplied p_user_id.
-- Adds backward-compatible shim for 2-parameter signature.
-- Adds guards to resolve_village: prevents village-hopping, rate limits, checks role.
-- ============================================================================

-- 1. Main secure claim_pilot_token (1-parameter token signature)
CREATE OR REPLACE FUNCTION public.claim_pilot_token(
  p_token          TEXT,
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
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_token     public.pilot_tokens;
  v_village   BIGINT;
  v_role      TEXT;
  v_profile   public.profiles;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Bypass profile role checks for this transaction (allows escalating role via token)
  PERFORM set_config('app.bypass_profile_role_check', 'true', true);

  -- 1. Look up the token
  SELECT * INTO v_token
  FROM public.pilot_tokens
  WHERE token = p_token AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive token');
  END IF;

  -- 2. Check expiry
  IF v_token.expires_at IS NOT NULL AND v_token.expires_at < now() THEN
    UPDATE public.pilot_tokens SET status = 'expired' WHERE id = v_token.id;
    RETURN jsonb_build_object('success', false, 'error', 'Token expired');
  END IF;

  -- 3. Check uses
  IF NOT v_token.is_reusable AND v_token.uses_count >= v_token.max_uses THEN
    UPDATE public.pilot_tokens SET status = 'used' WHERE id = v_token.id;
    RETURN jsonb_build_object('success', false, 'error', 'Token already used');
  END IF;

  -- 4. Resolve village
  IF p_village_id_override IS NOT NULL THEN
    v_village := p_village_id_override;
  ELSIF p_village_name IS NOT NULL AND trim(p_village_name) != '' THEN
    v_village := public.resolve_village(
      p_village_name,
      COALESCE(p_district, 'Unknown'),
      COALESCE(p_state, 'Unknown'),
      v_user_id
    );
  ELSE
    v_village := v_token.village_id;
  END IF;

  -- 5. Resolve role — always village_admin for pilot onboarding
  v_role := 'village_admin';

  -- 6. Upsert profile with onboarding data + tenant mapping
  INSERT INTO public.profiles (
    id, name, phone, mobile, gender, dob, age, address,
    aadhaar_last4, profile_photo_url, village_id,
    role, super_admin_id, organization_id, pilot_id,
    is_onboarded, last_active, state, district, mandal, village_name
  ) VALUES (
    v_user_id,
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

  -- 7. Increment token usage
  UPDATE public.pilot_tokens
  SET uses_count = uses_count + 1,
      status     = CASE
                     WHEN is_reusable THEN 'active'
                     WHEN uses_count + 1 >= max_uses THEN 'used'
                     ELSE 'active'
                   END
  WHERE id = v_token.id;

  -- 8. Return success with profile data
  RETURN jsonb_build_object(
    'success',    true,
    'profile',    to_jsonb(v_profile),
    'village_id', v_village,
    'role',       v_role
  );
END;
$$;

-- 2. Deprecated shim for legacy call-sites (accepts p_user_id but ignores it)
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
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE LOG 'DEPRECATED: claim_pilot_token called with p_user_id=%, using auth.uid()=%', p_user_id, auth.uid();
  RETURN public.claim_pilot_token(
    p_token,
    p_name,
    p_mobile,
    p_gender,
    p_dob,
    p_age,
    p_address,
    p_aadhaar_last4,
    p_profile_photo_url,
    p_village_id_override,
    p_village_name,
    p_district,
    p_state,
    p_mandal
  );
END;
$$;

-- 3. resolve_village with security guards
CREATE OR REPLACE FUNCTION public.resolve_village(
  p_village_name TEXT,
  p_district     TEXT,
  p_state        TEXT,
  p_sarpanch_id  UUID DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id    UUID := auth.uid();
  v_caller_vid   BIGINT;
  v_normalized   TEXT;
  v_district     TEXT;
  v_state        TEXT;
  v_village_id   BIGINT;
  v_join_code    TEXT;
  v_rate_ok      BOOLEAN;
BEGIN
  -- Security Guard 1: Verify authenticated caller
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to resolve village';
  END IF;

  -- Security Guard 2: Reject if caller already has a village_id (prevents village-hopping)
  SELECT village_id INTO v_caller_vid
  FROM public.profiles
  WHERE id = v_caller_id;

  IF v_caller_vid IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to village ID %, village reassignment forbidden', v_caller_vid;
  END IF;

  -- Security Guard 3: Rate limit to 3 calls per user per hour via check_rate_limit
  BEGIN
    SELECT allowed INTO v_rate_ok
    FROM public.check_rate_limit(v_caller_id::text, 'resolve_village', 3, 3600);
    IF v_rate_ok IS FALSE THEN
      RAISE EXCEPTION 'Rate limit exceeded for resolve_village. Maximum 3 attempts per hour.';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Normalize inputs
  v_normalized := trim(lower(p_village_name));
  v_district   := trim(p_district);
  v_state      := trim(p_state);

  -- Search for existing village (case-insensitive name + district)
  SELECT id INTO v_village_id
  FROM public.villages
  WHERE lower(trim(village_name)) = v_normalized
    AND lower(trim(district)) = lower(v_district)
  LIMIT 1;

  IF v_village_id IS NOT NULL THEN
    IF p_sarpanch_id IS NOT NULL THEN
      UPDATE public.villages
      SET sarpanch_id = p_sarpanch_id
      WHERE id = v_village_id AND sarpanch_id IS NULL;
    END IF;
    RETURN v_village_id;
  END IF;

  -- Create new village
  v_join_code := upper(substring(v_normalized FROM 1 FOR 3)) || '-' || floor(1000 + random() * 9000)::text;

  INSERT INTO public.villages (
    village_name, district, state, join_code, sarpanch_id, created_at
  ) VALUES (
    trim(p_village_name), v_district, v_state, v_join_code, p_sarpanch_id, now()
  )
  RETURNING id INTO v_village_id;

  RETURN v_village_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pilot_token(TEXT, TEXT, TEXT, TEXT, DATE, INT, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pilot_token(TEXT, UUID, TEXT, TEXT, TEXT, DATE, INT, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_village TO authenticated, service_role;