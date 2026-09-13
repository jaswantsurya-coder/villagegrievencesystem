-- ============================================================================
-- 022_phase1_data_model_consolidation.sql
-- GramSeva â€” Phase 1 Production Data Model Consolidation
-- 
-- Summary of Changes:
-- 1. Fast fail on lock timeout to prevent queue contention.
-- 2. Safe truncation & schema fix for ai_processing_queue.village_id (UUID -> BIGINT).
-- 3. Schema additions to public.profiles (email, full_name), trigger, and historical backfill.
-- 4. Scoped RLS on public.profiles to protect citizen PII with explicit helper execution grants.
-- 5. 14-day invitation expiration enforcement in accept_invitation and lookup_invitation.
-- 6. Canonical svc_create_complaint consolidation with explicit dropping of all 6 legacy overloads.
-- 7. PostgREST schema cache reload signal.
-- ============================================================================

BEGIN;

-- 1. Prevent connection pool lockups during DDL operations
SET LOCAL lock_timeout = '5s';

-- ============================================================================
-- 2. Safe Schema Fix: ai_processing_queue.village_id (UUID -> BIGINT)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'ai_processing_queue'
  ) THEN
    -- Ephemeral queue: truncate before modifying column type to prevent error 42804
    TRUNCATE TABLE public.ai_processing_queue;
    
    ALTER TABLE public.ai_processing_queue 
      DROP COLUMN IF EXISTS village_id;
      
    ALTER TABLE public.ai_processing_queue 
      ADD COLUMN village_id BIGINT REFERENCES public.villages(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_ai_queue_village_id ON public.ai_processing_queue(village_id);
  END IF;
END $$;

-- ============================================================================
-- 3. Profiles: Add Missing Columns, Auto-Sync Trigger & Historical Backfill
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Function to keep profiles.email in sync with auth.users
CREATE OR REPLACE FUNCTION public.handle_user_email_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    email = NEW.email,
    full_name = COALESCE(public.profiles.full_name, NEW.raw_user_meta_data->>'full_name')
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.handle_user_email_sync() OWNER TO postgres;

DROP TRIGGER IF EXISTS on_auth_user_email_sync ON auth.users;
CREATE TRIGGER on_auth_user_email_sync
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_email_sync();

-- Idempotent historical data backfill
UPDATE public.profiles p
SET 
  email = u.email,
  full_name = COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', '')
FROM auth.users u
WHERE p.id = u.id 
  AND (p.email IS NULL OR p.full_name IS NULL);

-- ============================================================================
-- 4. PII Protection: Scoped RLS on public.profiles
-- ============================================================================
-- Ensure execute grants on security definer helper functions
GRANT EXECUTE ON FUNCTION public.sec_get_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sec_get_village() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sec_is_district_village(bigint) TO authenticated;

-- Replace wide policy with scoped RLS
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_scoped" ON public.profiles;

CREATE POLICY "profiles_select_scoped" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.sec_get_role() = 'super_admin'
  OR (
    public.sec_get_role() = 'district_admin'
    AND village_id IS NOT NULL
    AND public.sec_is_district_village(village_id)
  )
  OR (
    public.sec_get_village() IS NOT NULL
    AND village_id = public.sec_get_village()
    AND public.sec_get_role() IN ('village_admin', 'officer')
  )
);

-- ============================================================================
-- 5. Invitations: Enforce 14-Day TTL in accept_invitation & lookup_invitation
-- ============================================================================
ALTER TABLE public.invitations 
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '14 days');

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
    UPDATE public.invitations 
    SET status = 'expired' 
    WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has expired');
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

CREATE OR REPLACE FUNCTION public.lookup_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  SELECT 
    i.*,
    v.village_name,
    v.district
  INTO v_invitation
  FROM public.invitations i
  LEFT JOIN public.villages v ON v.id = i.village_id
  WHERE i.token = p_token
  LIMIT 1;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid invitation token');
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

-- ============================================================================
-- 6. Canonical svc_create_complaint Consolidation
-- ============================================================================
-- Explicitly drop all 6 legacy/overloaded signatures
DROP FUNCTION IF EXISTS public.svc_create_complaint(text, text, text, text, numeric, numeric, text, text, text, boolean, text, bigint);
DROP FUNCTION IF EXISTS public.svc_create_complaint(text, text, text, text, numeric, numeric, text, text, boolean, text, bigint);
DROP FUNCTION IF EXISTS public.svc_create_complaint(text, text, text, text, numeric, numeric, jsonb, jsonb, text, boolean, text, bigint);
DROP FUNCTION IF EXISTS public.svc_create_complaint(text, text, text, text, double precision, double precision, text[], text[], text, boolean, text);
DROP FUNCTION IF EXISTS public.svc_create_complaint(text, text, text, text, double precision, double precision, jsonb, text[], text, boolean, text);
DROP FUNCTION IF EXISTS public.svc_create_complaint(text, text, text, text, numeric, numeric, jsonb, text, boolean, text, bigint);

-- Ensure related_scheme column exists
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS related_scheme TEXT;

-- Create canonical 12-parameter function
CREATE OR REPLACE FUNCTION public.svc_create_complaint(
  p_title            TEXT,
  p_description      TEXT,
  p_category         TEXT,
  p_location         TEXT DEFAULT NULL,
  p_latitude         NUMERIC DEFAULT NULL,
  p_longitude        NUMERIC DEFAULT NULL,
  p_photos           JSONB DEFAULT '[]'::jsonb,
  p_photo_urls       JSONB DEFAULT '[]'::jsonb,
  p_related_scheme   TEXT DEFAULT NULL,
  p_is_anonymous     BOOLEAN DEFAULT FALSE,
  p_anonymous_phone  TEXT DEFAULT NULL,
  p_village_id       BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket_id    TEXT;
  v_citizen_id   UUID;
  v_village_id   BIGINT;
  v_complaint_id UUID;
  v_exists       BOOLEAN;
  v_attempts     INTEGER := 0;
  v_photos_jsonb JSONB;
  v_urls_jsonb   JSONB;
BEGIN
  -- 1. Caller identity resolution
  IF auth.uid() IS NOT NULL THEN
    v_citizen_id := auth.uid();
  ELSIF NOT COALESCE(p_is_anonymous, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid request: unauthenticated submission must be anonymous');
  ELSE
    v_citizen_id := NULL;
  END IF;

  -- 2. Safe rate limiting
  IF auth.uid() IS NOT NULL THEN
    BEGIN
      IF NOT public.check_rate_limit(
        'complaint_request:' || auth.uid()::text,
        20,
        interval '1 hour'
      ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Rate limit exceeded. Maximum 20 complaints per hour.');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  ELSIF COALESCE(p_is_anonymous, false) AND p_anonymous_phone IS NOT NULL THEN
    BEGIN
      IF NOT public.check_rate_limit(
        'anonymous_phone:' || public.normalize_phone(p_anonymous_phone),
        5,
        interval '1 hour'
      ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Too many anonymous reports. Please try again later.');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- 3. Resolve target village in priority order:
  -- A. Explicit p_village_id parameter
  IF p_village_id IS NOT NULL THEN
    SELECT id INTO v_village_id FROM public.villages WHERE id = p_village_id;
    IF v_village_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid village specified');
    END IF;
  END IF;

  -- B. Geographic coordinate resolution via PostGIS
  IF v_village_id IS NULL AND p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    BEGIN
      v_village_id := public.find_village_by_coords(p_latitude, p_longitude);
    EXCEPTION WHEN OTHERS THEN
      v_village_id := NULL;
    END;
  END IF;

  -- C. Citizen profile fallback
  IF v_village_id IS NULL AND v_citizen_id IS NOT NULL THEN
    SELECT village_id INTO v_village_id
    FROM public.profiles
    WHERE id = v_citizen_id;
  END IF;

  -- D. Fail closed: no arbitrary village assignment
  IF v_village_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unable to resolve village from coordinates or registered profile. Please select your village.'
    );
  END IF;

  -- 4. Normalize JSONB arrays
  v_photos_jsonb := COALESCE(p_photos, '[]'::JSONB);
  v_urls_jsonb   := COALESCE(p_photo_urls, '[]'::JSONB);

  -- 5. Collision-safe unique ticket generation
  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      RAISE EXCEPTION 'Unable to generate unique ticket ID after 20 attempts';
    END IF;
    v_ticket_id := 'VGS-' || upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 8));
    SELECT EXISTS(SELECT 1 FROM public.complaints WHERE ticket_id = v_ticket_id) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  -- 6. Atomic complaint insertion
  INSERT INTO public.complaints (
    ticket_id,
    title,
    description,
    category,
    status,
    citizen_id,
    photos,
    photo_urls,
    location,
    latitude,
    longitude,
    is_anonymous,
    anonymous_phone,
    village_id,
    related_scheme
  )
  VALUES (
    v_ticket_id,
    p_title,
    p_description,
    p_category,
    'Open',
    CASE WHEN COALESCE(p_is_anonymous, false) THEN NULL ELSE v_citizen_id END,
    v_photos_jsonb,
    v_urls_jsonb,
    p_location,
    p_latitude,
    p_longitude,
    COALESCE(p_is_anonymous, false),
    CASE WHEN COALESCE(p_is_anonymous, false) THEN p_anonymous_phone ELSE NULL END,
    v_village_id,
    p_related_scheme
  )
  RETURNING id INTO v_complaint_id;

  -- 7. Audit log creation
  BEGIN
    INSERT INTO public.audit_logs (
      action,
      entity_type,
      entity_id,
      actor_id,
      details
    ) VALUES (
      'complaint_created',
      'complaints',
      v_complaint_id,
      v_citizen_id,
      jsonb_build_object(
        'ticket_id', v_ticket_id,
        'category', p_category,
        'village_id', v_village_id,
        'is_anonymous', COALESCE(p_is_anonymous, false)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id,
    'complaint_id', v_complaint_id,
    'village_id', v_village_id,
    'status', 'Open'
  );
END;
$$;

ALTER FUNCTION public.svc_create_complaint(
  TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB, JSONB, TEXT, BOOLEAN, TEXT, BIGINT
) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.svc_create_complaint(
  TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB, JSONB, TEXT, BOOLEAN, TEXT, BIGINT
) TO anon, authenticated;

-- ============================================================================
-- 7. PostgREST Cache Invalidation
-- ============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
