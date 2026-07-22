-- ============================================================================
-- 008: Pilot Onboarding System
-- Creates pilot_tokens table, adds onboarding columns to profiles,
-- and provides RPC functions for the complete pilot token lifecycle.
-- Run this migration in the Auxiliary Supabase project (dtucrczgagpzjbbrwqit)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. pilot_tokens table
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pilot_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token         TEXT UNIQUE NOT NULL,
  super_admin_id UUID,
  village_id    BIGINT REFERENCES public.villages(id) ON DELETE SET NULL,
  organization_id UUID,
  pilot_id      TEXT,
  role          TEXT NOT NULL DEFAULT 'sarpanch',
  is_reusable   BOOLEAN NOT NULL DEFAULT false,
  max_uses      INT NOT NULL DEFAULT 1,
  uses_count    INT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'used', 'expired', 'revoked')),
  expires_at    TIMESTAMPTZ,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pilot_tokens_token   ON public.pilot_tokens (token);
CREATE INDEX IF NOT EXISTS idx_pilot_tokens_status  ON public.pilot_tokens (status);
CREATE INDEX IF NOT EXISTS idx_pilot_tokens_village ON public.pilot_tokens (village_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Add onboarding columns to profiles (idempotent)
-- ────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='gender') THEN
    ALTER TABLE public.profiles ADD COLUMN gender TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='dob') THEN
    ALTER TABLE public.profiles ADD COLUMN dob DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='age') THEN
    ALTER TABLE public.profiles ADD COLUMN age INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='address') THEN
    ALTER TABLE public.profiles ADD COLUMN address TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='aadhaar_last4') THEN
    ALTER TABLE public.profiles ADD COLUMN aadhaar_last4 TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='super_admin_id') THEN
    ALTER TABLE public.profiles ADD COLUMN super_admin_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='organization_id') THEN
    ALTER TABLE public.profiles ADD COLUMN organization_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='pilot_id') THEN
    ALTER TABLE public.profiles ADD COLUMN pilot_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='profile_photo_url') THEN
    ALTER TABLE public.profiles ADD COLUMN profile_photo_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_onboarded') THEN
    ALTER TABLE public.profiles ADD COLUMN is_onboarded BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='last_active') THEN
    ALTER TABLE public.profiles ADD COLUMN last_active TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='mobile') THEN
    ALTER TABLE public.profiles ADD COLUMN mobile TEXT;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. RPC: create_pilot_token
--    Called by Super Admin Dashboard (service-role client).
--    Generates a cryptographically secure token and stores it.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_pilot_token(
  p_super_admin_id UUID,
  p_village_id     BIGINT,
  p_role           TEXT DEFAULT 'sarpanch',
  p_is_reusable    BOOLEAN DEFAULT false,
  p_max_uses       INT DEFAULT 1,
  p_expires_hours  INT DEFAULT 168,           -- default 7 days
  p_organization_id UUID DEFAULT NULL,
  p_pilot_id       TEXT DEFAULT NULL,
  p_created_by     UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token TEXT;
  v_row   public.pilot_tokens;
BEGIN
  -- Generate a cryptographically secure 32-byte hex token
  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.pilot_tokens (
    token, super_admin_id, village_id, role, is_reusable,
    max_uses, status, expires_at, organization_id, pilot_id, created_by
  ) VALUES (
    v_token,
    p_super_admin_id,
    p_village_id,
    COALESCE(p_role, 'sarpanch'),
    COALESCE(p_is_reusable, false),
    COALESCE(p_max_uses, 1),
    'active',
    now() + (p_expires_hours || ' hours')::INTERVAL,
    p_organization_id,
    p_pilot_id,
    p_created_by
  )
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row);
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. RPC: lookup_pilot_token
--    Public read-only lookup. Returns token metadata if valid.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lookup_pilot_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row public.pilot_tokens;
BEGIN
  SELECT * INTO v_row
  FROM public.pilot_tokens
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Token not found');
  END IF;

  -- Check expiry
  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() THEN
    UPDATE public.pilot_tokens SET status = 'expired' WHERE id = v_row.id;
    RETURN json_build_object('valid', false, 'error', 'Token expired');
  END IF;

  -- Check status
  IF v_row.status != 'active' THEN
    RETURN json_build_object('valid', false, 'error', 'Token is ' || v_row.status);
  END IF;

  -- Check usage limits
  IF NOT v_row.is_reusable AND v_row.uses_count >= v_row.max_uses THEN
    UPDATE public.pilot_tokens SET status = 'used' WHERE id = v_row.id;
    RETURN json_build_object('valid', false, 'error', 'Token already used');
  END IF;

  -- Return valid token info (excluding the token itself for security)
  RETURN json_build_object(
    'valid',           true,
    'id',              v_row.id,
    'village_id',      v_row.village_id,
    'role',            v_row.role,
    'super_admin_id',  v_row.super_admin_id,
    'organization_id', v_row.organization_id,
    'pilot_id',        v_row.pilot_id,
    'is_reusable',     v_row.is_reusable,
    'expires_at',      v_row.expires_at
  );
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. RPC: claim_pilot_token
--    Called after user authenticates and completes onboarding form.
--    Atomically: upserts profile, maps tenant IDs, sets role, increments token usage.
-- ────────────────────────────────────────────────────────────────────────────

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
  p_village_id_override BIGINT DEFAULT NULL
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

  -- 4. Resolve village and role
  v_village := COALESCE(p_village_id_override, v_token.village_id);
  v_role    := CASE WHEN v_token.role = 'sarpanch' THEN 'village_admin' ELSE v_token.role END;

  -- 5. Upsert profile with onboarding data + tenant mapping
  INSERT INTO public.profiles (
    id, name, mobile, gender, dob, age, address,
    aadhaar_last4, profile_photo_url, village_id,
    role, super_admin_id, organization_id, pilot_id,
    is_onboarded, last_active
  ) VALUES (
    p_user_id,
    COALESCE(p_name, ''),
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
    true,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    name              = COALESCE(NULLIF(EXCLUDED.name, ''), profiles.name),
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
    is_onboarded      = true,
    last_active       = now()
  RETURNING * INTO v_profile;

  -- 6. Increment token usage
  UPDATE public.pilot_tokens
  SET uses_count = uses_count + 1,
      status     = CASE
                     WHEN is_reusable THEN 'active'
                     WHEN uses_count + 1 >= max_uses THEN 'used'
                     ELSE 'active'
                   END
  WHERE id = v_token.id;

  -- 7. Return success with profile data
  RETURN json_build_object(
    'success',    true,
    'profile',    row_to_json(v_profile),
    'village_id', v_village,
    'role',       v_role
  );
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. RPC: revoke_pilot_token
--    Called by Super Admin to revoke a token.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.revoke_pilot_token(p_token_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row public.pilot_tokens;
BEGIN
  UPDATE public.pilot_tokens
  SET status = 'revoked'
  WHERE id = p_token_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Token not found');
  END IF;

  RETURN json_build_object('success', true, 'token_id', v_row.id);
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. RLS Policies for pilot_tokens
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.pilot_tokens ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (Super Admin backend)
DROP POLICY IF EXISTS pilot_tokens_service ON public.pilot_tokens;
CREATE POLICY pilot_tokens_service ON public.pilot_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read tokens (needed for lookup_pilot_token RPC)
DROP POLICY IF EXISTS pilot_tokens_read ON public.pilot_tokens;
CREATE POLICY pilot_tokens_read ON public.pilot_tokens
  FOR SELECT
  USING (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.pilot_tokens TO anon, authenticated;
GRANT ALL ON public.pilot_tokens TO service_role;
GRANT EXECUTE ON FUNCTION public.create_pilot_token TO service_role;
GRANT EXECUTE ON FUNCTION public.lookup_pilot_token TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pilot_token TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_pilot_token TO service_role;
