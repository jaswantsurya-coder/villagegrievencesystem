-- ============================================================================
-- 010_fix_complaint_submission.sql
-- GramSeva — Standalone patch to enable complaint submission
--
-- RUN THIS IN YOUR SUPABASE SQL EDITOR:
-- Dashboard > SQL Editor > New Query > paste this entire file > Run
-- ============================================================================

-- ─── Step 1: Create a simplified svc_create_complaint function ─────────────
-- This is a self-contained version that does NOT require check_rate_limit
-- or find_village_by_coords. It resolves village_id from the authenticated
-- user's profile if p_village_id is not supplied.

CREATE OR REPLACE FUNCTION public.svc_create_complaint(
  p_title            TEXT,
  p_description      TEXT,
  p_category         TEXT,
  p_location         TEXT,
  p_latitude         NUMERIC,
  p_longitude        NUMERIC,
  p_photos           TEXT,      -- JSON string or '[]'
  p_photo_urls       TEXT,      -- JSON string or '[]'
  p_related_scheme   TEXT,
  p_is_anonymous     BOOLEAN,
  p_anonymous_phone  TEXT,
  p_village_id       BIGINT
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

  -- 1. Resolve caller identity
  IF auth.uid() IS NOT NULL THEN
    v_citizen_id := auth.uid();
  ELSIF NOT p_is_anonymous THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- 2. Resolve village_id
  v_village_id := p_village_id;

  -- If not supplied, fall back to the citizen's registered village
  IF v_village_id IS NULL AND v_citizen_id IS NOT NULL THEN
    SELECT village_id INTO v_village_id
    FROM public.profiles
    WHERE id = v_citizen_id;
  END IF;

  -- If still null, pick any village (graceful degradation)
  IF v_village_id IS NULL THEN
    SELECT id INTO v_village_id FROM public.villages ORDER BY id LIMIT 1;
  END IF;

  IF v_village_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No village found. Please contact your village admin.');
  END IF;

  -- 3. Parse JSON strings safely
  BEGIN
    v_photos_jsonb := COALESCE(p_photos::JSONB, '[]'::JSONB);
  EXCEPTION WHEN OTHERS THEN
    v_photos_jsonb := '[]'::JSONB;
  END;

  BEGIN
    v_urls_jsonb := COALESCE(p_photo_urls::JSONB, '[]'::JSONB);
  EXCEPTION WHEN OTHERS THEN
    v_urls_jsonb := '[]'::JSONB;
  END;

  -- 4. Generate unique Ticket ID
  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      RAISE EXCEPTION 'Unable to generate unique ticket ID after 20 attempts';
    END IF;
    v_ticket_id := 'VGS-' || upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6));
    SELECT EXISTS(SELECT 1 FROM public.complaints WHERE ticket_id = v_ticket_id) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  -- 5. Insert the complaint
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
    village_id
  )
  VALUES (
    v_ticket_id,
    p_title,
    p_description,
    p_category,
    'Open',
    CASE WHEN p_is_anonymous THEN NULL ELSE v_citizen_id END,
    v_photos_jsonb,
    v_urls_jsonb,
    p_location,
    p_latitude,
    p_longitude,
    COALESCE(p_is_anonymous, false),
    CASE WHEN p_is_anonymous THEN p_anonymous_phone ELSE NULL END,
    v_village_id
  )
  RETURNING id INTO v_complaint_id;

  RETURN jsonb_build_object(
    'success',    true,
    'complaint_id', v_complaint_id,
    'ticket_id',  v_ticket_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute to all authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.svc_create_complaint(
  TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN, TEXT, BIGINT
) TO authenticated, anon;

-- ─── Step 2: Ensure INSERT is revoked (function handles it securely) ────────
-- Only svc_create_complaint (running as postgres/SECURITY DEFINER) can insert.
REVOKE INSERT ON public.complaints FROM authenticated, anon;

-- ─── Step 3: Refresh PostgREST schema cache ─────────────────────────────────
-- This tells Supabase's API layer to pick up the new function immediately.
NOTIFY pgrst, 'reload schema';

-- ─── Verification ────────────────────────────────────────────────────────────
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'svc_create_complaint';
-- Expected: one row with routine_type = 'FUNCTION'
