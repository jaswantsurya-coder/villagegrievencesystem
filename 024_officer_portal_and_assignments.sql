-- ============================================================================
-- 024_officer_portal_and_assignments.sql
-- GramSeva — Dedicated Officer Portal, Officer Invitations, and Complaint Assignment
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 1. EXTEND PROFILES, INVITATIONS, AND COMPLAINTS TABLES ─────────────────

-- Department / Designation for staff & officers
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;

-- Officer name, phone & department details on invitations
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS department TEXT;

-- Complaint tracking fields for officer assignments and resolution
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS work_notes TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS completion_report TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS completion_photos JSONB DEFAULT '[]'::jsonb;

-- Indexes for efficient officer filtering & assignment lookups
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_officer 
  ON public.complaints(assigned_officer_id) 
  WHERE assigned_officer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_role_village 
  ON public.profiles(role, village_id);

-- ─── 2. REVISE RLS ON COMPLAINTS FOR OFFICER ISOLATION ──────────────────────

DROP POLICY IF EXISTS "complaints_select" ON public.complaints;
CREATE POLICY "complaints_select" ON public.complaints
FOR SELECT USING (
  -- Super admin can view all complaints
  public.sec_get_role() = 'super_admin'
  -- Citizens can view their own complaints
  OR citizen_id = auth.uid()
  -- Village admins can view complaints in their own village
  OR (
    public.sec_get_role() = 'village_admin'
    AND village_id = public.sec_get_village()
  )
  -- Officers can ONLY view complaints explicitly assigned to them
  OR (
    public.sec_get_role() = 'officer'
    AND assigned_officer_id = auth.uid()
  )
  -- District admins can view complaints in their district
  OR (
    public.sec_get_role() = 'district_admin'
    AND public.sec_is_district_village(village_id)
  )
);

DROP POLICY IF EXISTS "complaints_update" ON public.complaints;
CREATE POLICY "complaints_update" ON public.complaints
FOR UPDATE USING (
  -- Super admins can update all complaints
  public.sec_get_role() = 'super_admin'
  -- Village admins can update complaints in their village
  OR (
    public.sec_get_role() = 'village_admin'
    AND village_id = public.sec_get_village()
  )
  -- Officers can ONLY update complaints explicitly assigned to them
  OR (
    public.sec_get_role() = 'officer'
    AND assigned_officer_id = auth.uid()
  )
  -- District admins can update complaints in their district
  OR (
    public.sec_get_role() = 'district_admin'
    AND public.sec_is_district_village(village_id)
  )
);

-- ─── 3. SECURE RPC: LOOKUP INVITATION WITH OFFICER METADATA ─────────────────

CREATE OR REPLACE FUNCTION public.lookup_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation RECORD;
  v_village_name TEXT;
  v_village_district TEXT;
BEGIN
  SELECT i.*, v.village_name, v.district
  INTO v_invitation
  FROM public.invitations i
  JOIN public.villages v ON v.id = i.village_id
  WHERE i.token = p_token
  LIMIT 1;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation not found');
  END IF;

  IF v_invitation.status != 'pending' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', CASE
        WHEN v_invitation.status = 'revoked' THEN 'This invitation has been revoked'
        ELSE 'This invitation has already been used'
      END
    );
  END IF;

  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < NOW() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = v_invitation.id;
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation has expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'village_name', v_invitation.village_name,
    'district', v_invitation.district,
    'role', v_invitation.role,
    'name', v_invitation.name,
    'department', v_invitation.department,
    'email', v_invitation.email,
    'expires_at', v_invitation.expires_at
  );
END;
$$;
ALTER FUNCTION public.lookup_invitation(TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.lookup_invitation(TEXT) TO anon, authenticated;

-- ─── 4. SECURE RPC: ACCEPT INVITATION WITH DEPARTMENT & METADATA ────────────

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
    UPDATE public.invitations SET status = 'expired' WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has expired');
  END IF;

  -- Email restriction verification
  IF v_invitation.email IS NOT NULL THEN
    DECLARE
      v_user_email TEXT;
    BEGIN
      SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
      IF lower(COALESCE(v_user_email, '')) != lower(v_invitation.email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'This invitation was sent to a different email address');
      END IF;
    END;
  END IF;

  SELECT village_name INTO v_village_name FROM public.villages WHERE id = v_invitation.village_id;

  -- Bypass trigger role check
  PERFORM set_config('app.bypass_profile_role_check', 'true', true);

  -- Upsert profile with village, role, department, and name
  INSERT INTO public.profiles (id, village_id, role, department, name, phone)
  VALUES (
    v_user_id, 
    v_invitation.village_id, 
    v_invitation.role, 
    v_invitation.department, 
    COALESCE(v_invitation.name, 'Officer'), 
    v_invitation.phone
  )
  ON CONFLICT (id) DO UPDATE
  SET village_id = EXCLUDED.village_id,
      role = EXCLUDED.role,
      department = COALESCE(EXCLUDED.department, public.profiles.department),
      name = COALESCE(public.profiles.name, EXCLUDED.name),
      phone = COALESCE(public.profiles.phone, EXCLUDED.phone);

  PERFORM set_config('app.bypass_profile_role_check', 'false', true);

  -- Mark invitation as accepted
  UPDATE public.invitations
  SET status = 'accepted',
      used_at = NOW(),
      accepted_by = v_user_id
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'village_name', v_village_name,
    'village_id', v_invitation.village_id,
    'role', v_invitation.role,
    'department', v_invitation.department
  );
END;
$$;
ALTER FUNCTION public.accept_invitation(TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;

-- ─── 5. SECURE RPC: ASSIGN COMPLAINT TO OFFICER ─────────────────────────────

CREATE OR REPLACE FUNCTION public.assign_complaint_officer(
  p_complaint_id UUID,
  p_officer_id   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_village BIGINT;
  v_complaint RECORD;
  v_officer RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  v_caller_role := public.sec_get_role();
  v_caller_village := public.sec_get_village();

  -- Only admins can assign complaints
  IF v_caller_role NOT IN ('village_admin', 'district_admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only administrators can assign complaints');
  END IF;

  -- Fetch complaint
  SELECT * INTO v_complaint FROM public.complaints WHERE id = p_complaint_id;
  IF v_complaint IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Complaint not found');
  END IF;

  -- Village isolation check for Village Admin
  IF v_caller_role = 'village_admin' AND v_complaint.village_id != v_caller_village THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Complaint belongs to a different village');
  END IF;

  -- If unassigning (p_officer_id is NULL)
  IF p_officer_id IS NULL THEN
    UPDATE public.complaints
    SET assigned_officer_id = NULL,
        assigned_at = NULL,
        status = CASE WHEN status = 'Assigned' THEN 'Open' ELSE status END,
        updated_at = NOW()
    WHERE id = p_complaint_id;

    RETURN jsonb_build_object('success', true, 'message', 'Officer unassigned');
  END IF;

  -- Verify officer exists, has role 'officer', and belongs to the same village
  SELECT * INTO v_officer 
  FROM public.profiles 
  WHERE id = p_officer_id AND role = 'officer';

  IF v_officer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user is not a registered officer');
  END IF;

  IF v_officer.village_id != v_complaint.village_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Officer belongs to a different village');
  END IF;

  -- Apply assignment
  UPDATE public.complaints
  SET assigned_officer_id = p_officer_id,
      assigned_at = NOW(),
      status = CASE WHEN status = 'Open' THEN 'Assigned' ELSE status END,
      updated_at = NOW()
  WHERE id = p_complaint_id;

  RETURN jsonb_build_object(
    'success', true,
    'complaint_id', p_complaint_id,
    'officer_id', p_officer_id,
    'officer_name', v_officer.name,
    'officer_department', v_officer.department,
    'assigned_at', NOW()
  );
END;
$$;
ALTER FUNCTION public.assign_complaint_officer(UUID, UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.assign_complaint_officer(UUID, UUID) TO authenticated;

-- ─── 6. SECURE RPC: OFFICER WORK STATUS & COMPLETION UPDATE ─────────────────

CREATE OR REPLACE FUNCTION public.officer_update_complaint_progress(
  p_complaint_id       UUID,
  p_status             TEXT DEFAULT NULL,
  p_work_notes         TEXT DEFAULT NULL,
  p_completion_report  TEXT DEFAULT NULL,
  p_completion_photos  JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_complaint RECORD;
  v_new_status TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_complaint FROM public.complaints WHERE id = p_complaint_id;
  IF v_complaint IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Complaint not found');
  END IF;

  -- Verify caller is the assigned officer
  IF v_complaint.assigned_officer_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You are not assigned to this complaint');
  END IF;

  -- Officers can only transition to 'In Progress' or 'Resolved' (awaiting verification)
  -- They cannot mark as 'Closed' directly (admin verification required)
  IF p_status IS NOT NULL THEN
    IF p_status NOT IN ('In Progress', 'Resolved', 'Assigned') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid status: Officers may only update to Assigned, In Progress, or Resolved');
    END IF;
    v_new_status := p_status;
  ELSE
    v_new_status := v_complaint.status;
  END IF;

  UPDATE public.complaints
  SET status = v_new_status,
      work_notes = COALESCE(p_work_notes, work_notes),
      completion_report = COALESCE(p_completion_report, completion_report),
      completion_photos = COALESCE(p_completion_photos, completion_photos),
      updated_at = NOW()
  WHERE id = p_complaint_id;

  RETURN jsonb_build_object(
    'success', true,
    'complaint_id', p_complaint_id,
    'status', v_new_status,
    'updated_at', NOW()
  );
END;
$$;
ALTER FUNCTION public.officer_update_complaint_progress(UUID, TEXT, TEXT, TEXT, JSONB) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.officer_update_complaint_progress(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
