-- ============================================================================
-- GramSeva — 003_fix_profiles_recursion.sql
-- Removes 5 leftover policies from a pre-zero-recursion schema version.
-- "Village-scoped profile access" and "Admins can update all profiles" both
-- queried public.profiles from inside a policy on public.profiles, causing
-- infinite recursion on every SELECT/UPDATE touching profiles.
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated inserts" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Village-scoped profile access" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
