-- ============================================================================
-- 024_officer_portal_and_assignments_DOWN.sql
-- GramSeva — Rollback script for Officer Portal and Assignments Migration
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- 1. Drop added RPCs
DROP FUNCTION IF EXISTS public.officer_update_complaint_progress(UUID, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.assign_complaint_officer(UUID, UUID);

-- 2. Drop added indexes
DROP INDEX IF EXISTS public.idx_complaints_assigned_officer;
DROP INDEX IF EXISTS public.idx_profiles_role_village;

-- 3. Restore original complaints RLS policies (from 001)
DROP POLICY IF EXISTS "complaints_select" ON public.complaints;
CREATE POLICY "complaints_select" ON public.complaints
FOR SELECT USING (
  public.sec_get_role() = 'super_admin'
  OR citizen_id = auth.uid()
  OR (
    village_id = public.sec_get_village()
    AND public.sec_get_role() IN ('village_admin', 'officer')
  )
  OR (
    public.sec_get_role() = 'district_admin'
    AND public.sec_is_district_village(village_id)
  )
);

DROP POLICY IF EXISTS "complaints_update" ON public.complaints;
CREATE POLICY "complaints_update" ON public.complaints
FOR UPDATE USING (
  public.sec_get_role() = 'super_admin'
  OR (
    village_id = public.sec_get_village()
    AND public.sec_get_role() IN ('village_admin', 'officer')
  )
  OR (
    public.sec_get_role() = 'district_admin'
    AND public.sec_is_district_village(village_id)
  )
);

COMMIT;

NOTIFY pgrst, 'reload schema';
