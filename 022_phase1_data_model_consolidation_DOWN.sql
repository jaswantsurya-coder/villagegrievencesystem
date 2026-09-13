-- ============================================================================
-- 022_phase1_data_model_consolidation_DOWN.sql
-- Rollback for 022_phase1_data_model_consolidation.sql
-- ============================================================================

BEGIN;

-- 1. Restore wide profiles select policy
DROP POLICY IF EXISTS "profiles_select_scoped" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 2. Drop auth sync trigger
DROP TRIGGER IF EXISTS on_auth_user_email_sync ON auth.users;
DROP FUNCTION IF EXISTS public.handle_user_email_sync();

-- 3. Invalidate schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
