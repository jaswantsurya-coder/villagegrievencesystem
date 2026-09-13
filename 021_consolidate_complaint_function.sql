-- ============================================================================
-- 021_consolidate_complaint_function.sql
-- GramSeva — Consolidate svc_create_complaint into a single canonical function
-- Drops competing TEXT/JSONB and 11/12-param overloads to eliminate PostgREST ambiguity
-- ============================================================================

-- 1. Drop previous conflicting overloads
DROP FUNCTION IF EXISTS public.svc_create_complaint(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN, TEXT, BIGINT);
DROP FUNCTION IF EXISTS public.svc_create_complaint(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, BOOLEAN, TEXT, BIGINT);
DROP FUNCTION IF EXISTS public.svc_create_complaint(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB, JSONB, TEXT, BOOLEAN, TEXT, BIGINT);

-- Ensure related_scheme column exists
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS related_scheme TEXT;

-- 2. Define single canonical function
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
  v_constraint   TEXT;
BEGIN
  -- 1. Resolve caller identity
  IF auth.uid() IS NOT NULL THEN
    v_citizen_id := auth.uid();
  ELSIF NOT COALESCE(p_is_anonymous, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid request: unauthenticated submission must be anonymous');
  ELSE
    v_citizen_id := NULL;
  END IF;

  -- 2. Rate limiting check (safe fallback if check_rate_limit table not configured)
  IF auth.uid() IS NOT NULL THEN
    BEGIN
      IF NOT public.check_rate_limit(
        'complaint_request:' || auth.uid()::text,
        20,
        interval '1 hour'
      ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Rate limit exceeded');
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
        RETURN jsonb_build_object('success', false, 'error', 'Too many anonymous reports');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- 3. Resolve target village in priority order:
  -- A. If p_village_id is explicitly supplied, validate it exists
  IF p_village_id IS NOT NULL THEN
    SELECT id INTO v_village_id FROM public.villages WHERE id = p_village_id;
    IF v_village_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid village specified');
    END IF;
  END IF;

  -- B. Try geographic lookup from coordinates if no village resolved yet
  IF v_village_id IS NULL AND p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    BEGIN
      v_village_id := public.find_village_by_coords(p_latitude, p_longitude);
    EXCEPTION WHEN OTHERS THEN
      v_village_id := NULL;
    END;
  END IF;

  -- C. Fall back to citizen profile's registered village
  IF v_village_id IS NULL AND v_citizen_id IS NOT NULL THEN
    SELECT village_id INTO v_village_id
    FROM public.profiles
    WHERE id = v_citizen_id;
  END IF;

  -- D. Fail closed if unresolvable (prevents routing complaints to arbitrary villages)
  IF v_village_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unable to resolve village from coordinates or profile. Please select a valid village.'
    );
  END IF;

  -- 4. Normalize JSONB payloads safely
  v_photos_jsonb := COALESCE(p_photos, '[]'::JSONB);
  v_urls_jsonb   := COALESCE(p_photo_urls, '[]'::JSONB);

  -- 5. Generate unique Ticket ID with collision safety cap
  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      RAISE EXCEPTION 'Unable to generate unique ticket ID after 20 attempts';
    END IF;
    v_ticket_id := 'VGS-' || upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 8));
    SELECT EXISTS(SELECT 1 FROM public.complaints WHERE ticket_id = v_ticket_id) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  -- 6. Insert complaint into public.complaints
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

  RETURN jsonb_build_object(
    'success',      true,
    'complaint_id', v_complaint_id,
    'ticket_id',    v_ticket_id,
    'village_id',   v_village_id
  );

EXCEPTION
  WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'idx_complaints_dedup_fingerprint' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Duplicate complaint detected. Please wait before retrying.');
    END IF;
    RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

ALTER FUNCTION public.svc_create_complaint(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB, JSONB, TEXT, BOOLEAN, TEXT, BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.svc_create_complaint(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB, JSONB, TEXT, BOOLEAN, TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.svc_create_complaint(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB, JSONB, TEXT, BOOLEAN, TEXT, BIGINT) TO authenticated, anon, service_role;

-- Ensure direct INSERT is revoked so all writes go through this secure RPC
REVOKE INSERT ON public.complaints FROM authenticated, anon;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';