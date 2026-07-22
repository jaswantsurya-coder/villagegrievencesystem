-- GramSeva — 007_fix_profiles_rls_insert.sql
-- Fix Row Level Security policies on profiles table so all authenticated users / app clients can insert and update their profile records.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Select Policy
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT USING (true);

-- 2. Profiles Insert Policy
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
FOR INSERT WITH CHECK (true);

-- 3. Profiles Update Policy
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
FOR UPDATE USING (true)
WITH CHECK (true);

-- Grant appropriate table permissions
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
