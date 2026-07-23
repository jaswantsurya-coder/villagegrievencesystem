-- ============================================================================
-- 009: Fix Pilot Onboarding System
-- Adds location columns to profiles, creates village resolution helper,
-- updates claim_pilot_token to handle full onboarding with village resolution.
-- Run this migration in the Auxiliary Supabase project (dtucrczgagpzjbbrwqit)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Add location / onboarding columns to profiles (idempotent)
-- ────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='state') THEN
    ALTER TABLE public.profiles ADD COLUMN state TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='district') THEN
    ALTER TABLE public.profiles ADD COLUMN district TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='mandal') THEN
    ALTER TABLE public.profiles ADD COLUMN mandal TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='village_name') THEN
    ALTER TABLE public.profiles ADD COLUMN village_name TEXT;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. RPC: resolve_village
--    Normalizes village name, searches for existing village, creates if needed.
--    Returns the village ID (BIGINT).
-- ────────────────────────────────────────────────────────────────────────────

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
  v_normalized TEXT;
  v_district   TEXT;
  v_state      TEXT;
  v_village_id BIGINT;
  v_join_code  TEXT;
BEGIN
  -- Normalize: trim, collapse whitespace, lowercase for comparison
  v_normalized := trim(regexp_replace(lower(trim(p_village_name)), '\s+', ' ', 'g'));
  v_district   := trim(regexp_replace(lower(trim(COALESCE(p_district, 'Unknown'))), '\s+', ' ', 'g'));
  v_state      := trim(regexp_replace(lower(trim(COALESCE(p_state, 'Unknown'))), '\s+', ' ', 'g'));

  -- Search for existing village (case-insensitive, whitespace-normalized)
  SELECT id INTO v_village_id
  FROM public.villages
  WHERE lower(trim(regexp_replace(village_name, '\s+', ' ', 'g'))) = v_normalized
    AND lower(trim(regexp_replace(district, '\s+', ' ', 'g'))) = v_district
    AND lower(trim(regexp_replace(state, '\s+', ' ', 'g'))) = v_state
  LIMIT 1;

  IF v_village_id IS NOT NULL THEN
    -- Update sarpanch if provided and not already set
    IF p_sarpanch_id IS NOT NULL THEN
      UPDATE public.villages
      SET sarpanch_user_id = p_sarpanch_id
      WHERE id = v_village_id
        AND sarpanch_user_id IS NULL;
    END IF;
    RETURN v_village_id;
  END IF;

  -- Generate unique join code
  v_join_code := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));

  -- Ensure join code uniqueness
  WHILE EXISTS (SELECT 1 FROM public.villages WHERE join_code = v_join_code) LOOP
    v_join_code := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));
  END LOOP;

  -- Create new village with proper casing
  INSERT INTO public.villages (village_name, district, state, join_code, sarpanch_user_id)
  VALUES (
    initcap(v_normalized),
    initcap(v_district),
    initcap(v_state),
    v_join_code,
    p_sarpanch_id
  )
  RETURNING id INTO v_village_id;

  RETURN v_village_id;
END;
$$;

ALTER FUNCTION public.resolve_village(TEXT, TEXT, TEXT, UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.resolve_village TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Updated RPC: claim_pilot_token
--    Now accepts village name/district/state for village resolution.
--    Atomically: validates token -> resolves village -> upserts profile ->
--    increments token usage -> returns success.
-- ────────────────────────────────────────────────────────────────────────────

-- Drop the old overloaded signature to prevent PostgreSQL duplicate function errors
DROP FUNCTION IF EXISTS public.claim_pilot_token(TEXT, UUID, TEXT, TEXT, TEXT, DATE, INT, TEXT, TEXT, TEXT, BIGINT);

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
  -- 1. Look up the token
  SELECT * INTO v_token
  FROM public.pilot_tokens
  WHERE token = p_token AND status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or inactive token');
  END IF;

  -- 2. Check expiry
  IF v_token.expires_at IS NOT NULL AND v_token.expires_at < now() THEN
    UPDATE public.pilot_tokens SET status = 'expired' WHERE id = v_token.id;
    RETURN json_build_object('success', false, 'error', 'Token expired');
  END IF;

  -- 3. Check uses
  IF NOT v_token.is_reusable AND v_token.uses_count >= v_token.max_uses THEN
    UPDATE public.pilot_tokens SET status = 'used' WHERE id = v_token.id;
    RETURN json_build_object('success', false, 'error', 'Token already used');
  END IF;

  -- 4. Resolve village
  --    Priority: explicit override > village name resolution > token village_id
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

  -- 5. Resolve role — always village_admin for pilot onboarding
  v_role := 'village_admin';

  -- 6. Upsert profile with onboarding data + tenant mapping
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
  RETURN json_build_object(
    'success',    true,
    'profile',    row_to_json(v_profile),
    'village_id', v_village,
    'role',       v_role
  );
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Ensure villages table allows inserts from resolve_village RPC
-- ────────────────────────────────────────────────────────────────────────────

-- Grant sequence usage for village auto-increment
GRANT USAGE, SELECT ON SEQUENCE public.villages_id_seq TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Updated permissions
-- ────────────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.claim_pilot_token TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_village TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lookup_pilot_token TO anon, authenticated;
