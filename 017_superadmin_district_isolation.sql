-- ============================================================================
-- 017_superadmin_district_isolation.sql
-- SuperAdmin District Isolation Migration
-- Guarantees SuperAdmin HQ (srijaswantsuryacherri@gmail.com / super_admin role)
-- is never assigned to regular village admins or counted as a citizen village.
-- Run this in Auxiliary Supabase Project (dtucrczgagpzjbbrwqit)
-- ============================================================================

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

  -- Search for existing citizen village (EXCLUDING any village owned by super_admin)
  SELECT v.id INTO v_village_id
  FROM public.villages v
  LEFT JOIN public.profiles p ON p.id = v.sarpanch_user_id
  WHERE lower(trim(regexp_replace(v.village_name, '\s+', ' ', 'g'))) = v_normalized
    AND lower(trim(regexp_replace(v.district, '\s+', ' ', 'g'))) = v_district
    AND lower(trim(regexp_replace(v.state, '\s+', ' ', 'g'))) = v_state
    AND (p.role IS NULL OR p.role != 'super_admin')
    AND (p.email IS NULL OR p.email != 'srijaswantsuryacherri@gmail.com')
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
  v_join_code := upper(substring(md5(random()::text), 1, 8));

  -- Ensure join code uniqueness
  WHILE EXISTS (SELECT 1 FROM public.villages WHERE join_code = v_join_code) LOOP
    v_join_code := upper(substring(md5(random()::text), 1, 8));
  END LOOP;

  -- Create new distinct village for this admin to operate
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
