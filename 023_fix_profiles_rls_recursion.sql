-- ============================================================================
-- 023_fix_profiles_rls_recursion.sql
-- GramSeva — Fix Stack Depth Limit Exceeded & Profiles RLS Infinite Recursion
-- ============================================================================
-- 
-- PROBLEM SOLVED:
-- In 018_security_advisor_lockdown.sql, sec_get_role() and sec_get_village()
-- were set to SECURITY INVOKER. When 022_phase1_data_model_consolidation.sql
-- applied RLS policies on public.profiles that called sec_get_role(), any
-- authenticated query on public.profiles (or complaints joining citizen profiles)
-- entered an infinite recursion loop:
--   RLS Policy -> sec_get_role() -> SELECT profiles -> RLS Policy -> ...
-- This threw "ERROR: 54001: stack depth limit exceeded".
-- As a result:
-- 1. Complaints failed to load ("No complaints found" 0/0).
-- 2. Staff directory failed to load ("0 Citizens", Mujeeb missing).
-- 3. Analytics had 0 data because complaints query failed.
-- 4. Refresh CTA button and SLA scans appeared frozen/staggered.
--
-- SOLUTION:
-- 1. Redefine sec_get_role(), sec_get_village(), and sec_is_district_village()
--    as SECURITY DEFINER with search_path = public, pg_temp and OWNER TO postgres.
--    Because they execute with superuser/owner privileges, queries inside them
--    BYPASS Row Level Security on public.profiles, breaking the recursion loop.
-- 2. Cleanly drop any existing conflicting SELECT policies on public.profiles.
-- 3. Re-create the single canonical profiles_select_scoped policy.
-- 4. Reload PostgREST schema cache.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- 1. Helper: sec_get_role (SECURITY DEFINER to prevent RLS recursion)
CREATE OR REPLACE FUNCTION public.sec_get_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Fast-path: Check JWT claim first
  v_role := (auth.jwt() ->> 'user_role');
  IF v_role IS NOT NULL AND v_role != '' THEN
    RETURN v_role;
  END IF;

  -- If not logged in, return anon
  IF auth.uid() IS NULL THEN
    RETURN 'anon';
  END IF;

  -- Query profiles with superuser privileges (bypasses RLS recursion)
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role, 'citizen');
END;
$$;
ALTER FUNCTION public.sec_get_role() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.sec_get_role() TO authenticated, anon;

-- 2. Helper: sec_get_village (SECURITY DEFINER to prevent RLS recursion)
CREATE OR REPLACE FUNCTION public.sec_get_village()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_village_id BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  -- Query profiles with superuser privileges (bypasses RLS recursion)
  SELECT village_id INTO v_village_id FROM public.profiles WHERE id = auth.uid();
  RETURN v_village_id;
END;
$$;
ALTER FUNCTION public.sec_get_village() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.sec_get_village() TO authenticated, anon;

-- 3. Helper: sec_get_district (SECURITY DEFINER to prevent RLS recursion)
CREATE OR REPLACE FUNCTION public.sec_get_district()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_district TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT district INTO v_district FROM public.profiles WHERE id = auth.uid();
  RETURN v_district;
END;
$$;
ALTER FUNCTION public.sec_get_district() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.sec_get_district() TO authenticated, anon;

-- 4. Helper: sec_is_district_village (SECURITY DEFINER to prevent RLS recursion)
CREATE OR REPLACE FUNCTION public.sec_is_district_village(p_village_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_district TEXT;
  v_village_district TEXT;
BEGIN
  IF auth.uid() IS NULL OR p_village_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT district INTO v_user_district FROM public.profiles WHERE id = auth.uid();
  IF v_user_district IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT district INTO v_village_district FROM public.villages WHERE id = p_village_id;
  RETURN v_user_district = v_village_district;
END;
$$;
ALTER FUNCTION public.sec_is_district_village(BIGINT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.sec_is_district_village(BIGINT) TO authenticated, anon;

-- 5. Drop all existing SELECT policies on public.profiles to prevent conflicts
DROP POLICY IF EXISTS "profiles_select_scoped" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_authenticated" ON public.profiles;

-- 6. Create the single, non-recursive, scoped SELECT policy on public.profiles
CREATE POLICY "profiles_select_scoped" ON public.profiles
FOR SELECT TO authenticated
USING (
  -- 1. Users can always read their own profile
  id = auth.uid()
  -- 2. Super admins can read all profiles
  OR public.sec_get_role() = 'super_admin'
  -- 3. District admins can read profiles within their assigned district
  OR (
    public.sec_get_role() = 'district_admin'
    AND village_id IS NOT NULL
    AND public.sec_is_district_village(village_id)
  )
  -- 4. Village admins, sarpanchs, and officers can read profiles belonging to their village
  OR (
    public.sec_get_role() IN ('village_admin', 'officer', 'sarpanch')
    AND (
      village_id = public.sec_get_village()
      OR public.sec_get_village() IS NULL
    )
  )
);

COMMIT;

-- 7. Signal PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
