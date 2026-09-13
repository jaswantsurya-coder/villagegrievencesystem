-- ============================================================================
-- 011_svc_create_complaint_11params.sql
-- Quick fix: Add an 11-parameter overload of svc_create_complaint
-- to match the currently deployed Vercel code (which doesn't send p_related_scheme)
--
-- RUN THIS IN YOUR SUPABASE SQL EDITOR right now.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.svc_create_complaint(
  p_title            TEXT,
  p_description      TEXT,
  p_category         TEXT,
  p_location         TEXT,
  p_latitude         NUMERIC,
  p_longitude        NUMERIC,
  p_photos           TEXT,
  p_photo_urls       TEXT,
  p_is_anonymous     BOOLEAN,
  p_anonymous_phone  TEXT,
  p_village_id       BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Delegate to the 12-parameter version with NULL for p_related_scheme
  RETURN public.svc_create_complaint(
    p_title,
    p_description,
    p_category,
    p_location,
    p_latitude,
    p_longitude,
    p_photos,
    p_photo_urls,
    NULL,   -- p_related_scheme
    p_is_anonymous,
    p_anonymous_phone,
    p_village_id
  );
END;
$$;

-- Grant execute to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.svc_create_complaint(
  TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, BOOLEAN, TEXT, BIGINT
) TO authenticated, anon;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Verify all 3 overloads now exist
SELECT routine_name,
       string_agg(parameter_name, ', ' ORDER BY ordinal_position) AS params
FROM information_schema.routines r
JOIN information_schema.parameters p
  ON r.specific_name = p.specific_name
WHERE r.routine_schema = 'public'
  AND r.routine_name = 'svc_create_complaint'
  AND p.parameter_mode = 'IN'
GROUP BY routine_name, r.specific_name
ORDER BY count(*) ASC;
