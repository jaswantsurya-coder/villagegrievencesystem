-- ============================================================================
-- GramSeva — 004_migrate_roles_to_5tier.sql
-- Migrate from 4-role (super_admin, admin, officer, citizen) to 5-tier:
--   super_admin > district_admin > village_admin > officer > citizen
-- District isolation: district_admin only sees their own district's data.
-- ============================================================================

-- ─── STEP 1: Drop old constraint ─────────────────────────────────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- ─── STEP 2: Migrate existing 'admin' rows to 'village_admin' ───────────────
-- Must happen AFTER drop and BEFORE new constraint is added.
UPDATE public.profiles SET role = 'village_admin' WHERE role = 'admin';

-- ─── STEP 3: Add new role constraint ─────────────────────────────────────────
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('super_admin', 'district_admin', 'village_admin', 'officer', 'citizen'));

-- ─── STEP 3: New security helper — sec_get_district() ────────────────────────
-- Reads district from auth.users raw_app_meta_data (synced by trigger).
-- Zero-recursion: reads auth.users only, never profiles or villages.
CREATE OR REPLACE FUNCTION public.sec_get_district()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    raw_app_meta_data ->> 'district',
    NULL
  )
  FROM auth.users
  WHERE id = auth.uid();
$$;
ALTER FUNCTION public.sec_get_district() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sec_get_district() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sec_get_district() TO authenticated, anon, service_role;

-- ─── STEP 4: New security helper — sec_is_district_village(village_id) ───────
-- Checks if a given village_id belongs to the current user's district.
-- SECURITY DEFINER so it bypasses villages RLS. No recursion risk.
CREATE OR REPLACE FUNCTION public.sec_is_district_village(p_village_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.villages
    WHERE id = p_village_id
      AND district = (
        SELECT raw_app_meta_data ->> 'district'
        FROM auth.users
        WHERE id = auth.uid()
      )
  );
$$;
ALTER FUNCTION public.sec_is_district_village(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sec_is_district_village(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sec_is_district_village(BIGINT) TO authenticated, service_role;

-- ─── STEP 5: Update sync trigger to include district ─────────────────────────
-- When profile changes, sync role + village_id + district into auth.users metadata.
CREATE OR REPLACE FUNCTION public.sync_profile_to_auth_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_district TEXT;
BEGIN
  -- Look up district from the villages table if village_id is set
  IF NEW.village_id IS NOT NULL THEN
    SELECT district INTO v_district
    FROM public.villages
    WHERE id = NEW.village_id;
  ELSE
    v_district := NULL;
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'role', coalesce(NEW.role, 'citizen'),
      'village_id', NEW.village_id,
      'district', v_district
    )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.sync_profile_to_auth_metadata() OWNER TO postgres;

-- ─── STEP 6: Update get_current_village_join_code for new roles ──────────────
CREATE OR REPLACE FUNCTION public.get_current_village_join_code(p_id BIGINT)
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.sec_get_role() = 'super_admin' 
     OR (public.sec_get_role() = 'village_admin' AND public.sec_get_village() = p_id)
     OR (public.sec_get_role() = 'district_admin' AND public.sec_is_district_village(p_id))
  THEN
    RETURN (SELECT join_code FROM public.villages WHERE id = p_id);
  END IF;
  RETURN NULL;
END;
$$;
ALTER FUNCTION public.get_current_village_join_code(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_current_village_join_code(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_village_join_code(BIGINT) TO authenticated, service_role;

-- ─── STEP 7: Update check_profile_update trigger ────────────────────────────
-- Prevent self-role-modification (unchanged logic, just re-applied).
CREATE OR REPLACE FUNCTION public.check_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.id = auth.uid()
     AND NEW.role IS DISTINCT FROM OLD.role
  THEN
     RAISE EXCEPTION 'Cannot modify your own role';
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.check_profile_update() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.check_profile_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_profile_update() TO authenticated, service_role;

-- ─── STEP 8: Update svc_approve_admin_request — assigns 'village_admin' ──────
CREATE OR REPLACE FUNCTION public.svc_approve_admin_request(
  p_request_id BIGINT,
  p_reviewer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.admin_requests%ROWTYPE;
  v_village_id BIGINT;
  v_join_code TEXT;
  v_village_name TEXT;
  v_existing_sarpanch UUID;
  v_reviewer_id UUID;
BEGIN
  v_reviewer_id := auth.uid();
  IF v_reviewer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF public.sec_get_role() != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Only super_admin can approve requests.');
  END IF;

  SELECT * INTO v_request 
  FROM public.admin_requests 
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;

  SELECT id, join_code, sarpanch_user_id INTO v_village_id, v_join_code, v_existing_sarpanch
  FROM public.villages
  WHERE village_name = v_request.village_name
    AND district = v_request.district
    AND state = v_request.state
  FOR UPDATE;

  IF v_village_id IS NOT NULL AND v_existing_sarpanch IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This village already has an assigned Sarpanch');
  END IF;

  IF v_village_id IS NULL THEN
    v_join_code := public.generate_join_code();

    INSERT INTO public.villages (village_name, district, state, join_code, sarpanch_user_id)
    VALUES (v_request.village_name, v_request.district, v_request.state, v_join_code, v_request.user_id)
    RETURNING id INTO v_village_id;
  ELSE
    UPDATE public.villages SET sarpanch_user_id = v_request.user_id
    WHERE id = v_village_id;
  END IF;

  -- *** CHANGED: assign 'village_admin' instead of 'admin' ***
  UPDATE public.profiles
  SET role = 'village_admin', village_id = v_village_id
  WHERE id = v_request.user_id;

  UPDATE public.admin_requests
  SET status = 'approved', reviewed_by = v_reviewer_id, reviewed_at = NOW()
  WHERE id = p_request_id;

  INSERT INTO public.audit_logs (table_name, record_id, action, performed_by, old_data, new_data)
  VALUES (
    'admin_requests',
    p_request_id::text,
    'APPROVE',
    v_reviewer_id,
    to_jsonb(v_request),
    jsonb_build_object('status', 'approved', 'assigned_role', 'village_admin', 'village_id', v_village_id)
  );

  SELECT village_name INTO v_village_name FROM public.villages WHERE id = v_village_id;

  RETURN jsonb_build_object(
    'success', true,
    'village_id', v_village_id,
    'village_name', v_village_name,
    'join_code', v_join_code,
    'user_id', v_request.user_id
  );
END;
$$;
ALTER FUNCTION public.svc_approve_admin_request(BIGINT, UUID) OWNER TO postgres;

-- ─── STEP 9: Update can_read_complaint_evidence ──────────────────────────────
CREATE OR REPLACE FUNCTION public.can_read_complaint_evidence(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_my_village BIGINT;
  v_complaint_village BIGINT;
  v_complaint_id UUID;
  v_path_parts TEXT[];
BEGIN
  -- 1. Reject paths with fewer than 3 segments
  v_path_parts := string_to_array(p_object_name, '/');
  IF v_path_parts IS NULL OR array_length(v_path_parts, 1) < 3 THEN
    RETURN FALSE;
  END IF;

  -- 2. Verify complaint UUID parses correctly
  BEGIN
    v_complaint_id := v_path_parts[2]::UUID;
    IF v_complaint_id IS NULL THEN
      RETURN FALSE;
    END IF;
  EXCEPTION WHEN others THEN
    RETURN FALSE;
  END;

  -- 3. Verify complaint exists
  IF NOT EXISTS (
    SELECT 1 FROM public.complaints WHERE id = v_complaint_id LIMIT 1
  ) THEN
    RETURN FALSE;
  END IF;

  -- 4. Owner check (segment 1 matches auth.uid())
  IF auth.uid() IS NOT NULL AND v_path_parts[1] = auth.uid()::TEXT THEN
    RETURN TRUE;
  END IF;

  v_role := public.sec_get_role();

  -- 5. Super admin sees everything
  IF v_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  -- 6. District admin: complaint must be in their district
  IF v_role = 'district_admin' THEN
    SELECT village_id INTO v_complaint_village
    FROM public.complaints
    WHERE id = v_complaint_id
    LIMIT 1;

    RETURN v_complaint_village IS NOT NULL
       AND public.sec_is_district_village(v_complaint_village);
  END IF;

  -- 7. Village admin/officer: must be same village as the complaint
  IF v_role IN ('village_admin', 'officer') THEN
    v_my_village := public.sec_get_village();
    IF v_my_village IS NULL THEN
      RETURN FALSE;
    END IF;

    SELECT village_id INTO v_complaint_village
    FROM public.complaints
    WHERE id = v_complaint_id
    LIMIT 1;

    RETURN v_complaint_village IS NOT NULL
       AND v_complaint_village = v_my_village;
  END IF;

  -- All other roles: deny
  RETURN FALSE;
EXCEPTION WHEN others THEN
  RETURN FALSE;
END;
$$;
ALTER FUNCTION public.can_read_complaint_evidence(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.can_read_complaint_evidence(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_complaint_evidence(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.can_read_complaint_evidence(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_complaint_evidence(TEXT) TO authenticated, service_role;

-- ─── STEP 10: Update RLS Policies ───────────────────────────────────────────

-- 10.1 VILLAGES
DROP POLICY IF EXISTS "villages_select" ON public.villages;
CREATE POLICY "villages_select" ON public.villages
FOR SELECT USING (
  public.sec_get_role() = 'super_admin'
  OR id = public.sec_get_village()
  OR (
    public.sec_get_role() = 'district_admin'
    AND public.sec_is_district_village(id)
  )
);

DROP POLICY IF EXISTS "villages_insert" ON public.villages;
CREATE POLICY "villages_insert" ON public.villages
FOR INSERT WITH CHECK (
  public.sec_get_role() = 'super_admin'
);

DROP POLICY IF EXISTS "villages_update" ON public.villages;
CREATE POLICY "villages_update" ON public.villages
FOR UPDATE USING (
  public.sec_get_role() = 'super_admin'
  OR sarpanch_user_id = auth.uid()
)
WITH CHECK (
  public.sec_get_role() = 'super_admin'
);

-- 10.2 PROFILES
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT USING (
  id = auth.uid()
  OR public.sec_get_role() = 'super_admin'
  OR (
    public.sec_get_role() = 'district_admin'
    AND village_id IS NOT NULL
    AND public.sec_is_district_village(village_id)
  )
  OR (
    public.sec_get_village() IS NOT NULL
    AND village_id = public.sec_get_village()
    AND (
      role IN ('village_admin', 'officer')
      OR public.sec_get_role() IN ('village_admin', 'officer')
    )
  )
);

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
FOR INSERT WITH CHECK (
  id = auth.uid()
);

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
FOR UPDATE USING (
  id = auth.uid()
  OR public.sec_get_role() = 'super_admin'
  OR (
    public.sec_get_role() = 'district_admin'
    AND village_id IS NOT NULL
    AND public.sec_is_district_village(village_id)
  )
)
WITH CHECK (
  id = auth.uid()
  OR public.sec_get_role() = 'super_admin'
  OR (
    public.sec_get_role() = 'district_admin'
    AND village_id IS NOT NULL
    AND public.sec_is_district_village(village_id)
  )
);

-- 10.3 COMPLAINTS
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
)
WITH CHECK (
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

DROP POLICY IF EXISTS "complaints_delete" ON public.complaints;
CREATE POLICY "complaints_delete" ON public.complaints
FOR DELETE USING (
  public.sec_get_role() = 'super_admin'
  OR citizen_id = auth.uid()
);

-- 10.4 COMPLAINT HISTORY
DROP POLICY IF EXISTS "history_select" ON public.complaint_history;
CREATE POLICY "history_select" ON public.complaint_history
FOR SELECT USING (
  public.sec_get_role() = 'super_admin'
  OR user_id = auth.uid()
  OR (
    village_id = public.sec_get_village()
    AND public.sec_get_role() IN ('village_admin', 'officer')
  )
  OR (
    public.sec_get_role() = 'district_admin'
    AND public.sec_is_district_village(village_id)
  )
  OR public.sec_get_complaint_citizen(complaint_id) = auth.uid()
);

DROP POLICY IF EXISTS "history_insert" ON public.complaint_history;
CREATE POLICY "history_insert" ON public.complaint_history
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND (
    village_id = public.sec_get_village()
    OR public.sec_get_complaint_citizen(complaint_id) = auth.uid()
  )
);

-- 10.5 COMPLAINT RATINGS
DROP POLICY IF EXISTS "ratings_select" ON public.complaint_ratings;
CREATE POLICY "ratings_select" ON public.complaint_ratings
FOR SELECT USING (
  public.sec_get_role() = 'super_admin'
  OR village_id = public.sec_get_village()
  OR citizen_id = auth.uid()
  OR public.sec_get_complaint_citizen(complaint_id) = auth.uid()
  OR (
    public.sec_get_role() = 'district_admin'
    AND public.sec_is_district_village(village_id)
  )
);

DROP POLICY IF EXISTS "ratings_insert" ON public.complaint_ratings;
CREATE POLICY "ratings_insert" ON public.complaint_ratings
FOR INSERT WITH CHECK (
  citizen_id = auth.uid()
  AND (
    village_id = public.sec_get_village()
    OR public.sec_get_complaint_citizen(complaint_id) = auth.uid()
  )
);

DROP POLICY IF EXISTS "ratings_update" ON public.complaint_ratings;
CREATE POLICY "ratings_update" ON public.complaint_ratings
FOR UPDATE USING (
  citizen_id = auth.uid()
)
WITH CHECK (
  citizen_id = auth.uid()
);

-- 10.6 COMPLAINT UPVOTES
DROP POLICY IF EXISTS "upvotes_select" ON public.complaint_upvotes;
CREATE POLICY "upvotes_select" ON public.complaint_upvotes
FOR SELECT USING (
  public.sec_get_role() = 'super_admin'
  OR village_id = public.sec_get_village()
  OR user_id = auth.uid()
  OR public.sec_get_complaint_citizen(complaint_id) = auth.uid()
  OR (
    public.sec_get_role() = 'district_admin'
    AND public.sec_is_district_village(village_id)
  )
);

DROP POLICY IF EXISTS "upvotes_insert" ON public.complaint_upvotes;
CREATE POLICY "upvotes_insert" ON public.complaint_upvotes
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND village_id = public.sec_get_village()
);

DROP POLICY IF EXISTS "upvotes_delete" ON public.complaint_upvotes;
CREATE POLICY "upvotes_delete" ON public.complaint_upvotes
FOR DELETE USING (
  user_id = auth.uid()
);

-- 10.7 VILLAGE BOUNDARIES (unchanged — super_admin only for modify)
DROP POLICY IF EXISTS "boundaries_select" ON public.village_boundaries;
CREATE POLICY "boundaries_select" ON public.village_boundaries
FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "boundaries_modify" ON public.village_boundaries;
CREATE POLICY "boundaries_modify" ON public.village_boundaries
FOR ALL USING (
  public.sec_get_role() = 'super_admin'
);

-- 10.8 ADMIN REQUESTS (unchanged — super_admin reviews)
DROP POLICY IF EXISTS "admin_requests_select" ON public.admin_requests;
CREATE POLICY "admin_requests_select" ON public.admin_requests
FOR SELECT USING (
  user_id = auth.uid()
  OR public.sec_get_role() = 'super_admin'
);

DROP POLICY IF EXISTS "admin_requests_insert" ON public.admin_requests;
CREATE POLICY "admin_requests_insert" ON public.admin_requests
FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "admin_requests_update" ON public.admin_requests;
CREATE POLICY "admin_requests_update" ON public.admin_requests
FOR UPDATE USING (
  public.sec_get_role() = 'super_admin'
);

-- 10.9 HELP TICKETS (unchanged)
-- 10.10 AUDIT LOGS (unchanged — super_admin only)
-- 10.11 NOTIFICATIONS (unchanged — super_admin only)
-- 10.12 OUTBOX EVENTS (unchanged — super_admin only)

-- ─── STEP 11: Update storage policies ────────────────────────────────────────

DROP POLICY IF EXISTS "users_upload_admin_proofs" ON storage.objects;
CREATE POLICY "users_upload_admin_proofs" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'admin-proofs'
  AND auth.role() = 'authenticated'
  AND (
    public.sec_get_role() IN ('super_admin', 'district_admin', 'village_admin', 'officer')
    OR starts_with(name, auth.uid()::text || '/')
  )
);

DROP POLICY IF EXISTS "super_admin_view_admin_proofs" ON storage.objects;
CREATE POLICY "super_admin_view_admin_proofs" ON storage.objects
FOR SELECT USING (
  bucket_id = 'admin-proofs'
  AND (
    public.sec_get_role() = 'super_admin'
    OR starts_with(name, auth.uid()::text || '/')
  )
);

-- ─── STEP 12: Backfill district into auth.users metadata ─────────────────────
-- For all users who already have a village_id, sync their district.
-- This ensures sec_get_district() works immediately after migration.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.id, p.role, p.village_id, v.district
    FROM public.profiles p
    LEFT JOIN public.villages v ON v.id = p.village_id
    WHERE p.village_id IS NOT NULL
  LOOP
    UPDATE auth.users
    SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object(
        'role', coalesce(r.role, 'citizen'),
        'village_id', r.village_id,
        'district', r.district
      )
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- ─── STEP 13: Set admin roles for college review ─────────────────────────────
-- super_admin: system-wide control (sees ALL villages and grievances)
UPDATE public.profiles
SET
    role = 'super_admin',
    village_id = 1
WHERE id = 'ac10c774-49ee-4e83-aaba-b8181bf66442';

-- village_admin: village-level administration (sees own village grievances)
UPDATE public.profiles
SET
    role = 'village_admin',
    village_id = 1
WHERE id = '5be68c5b-bf17-4063-a3ac-7c095833ef70';

-- ============================================================================
-- MIGRATION COMPLETE
-- Your role hierarchy is now:
--   super_admin    → sees ALL villages, ALL grievances system-wide
--   district_admin → sees only grievances in villages of THEIR district
--   village_admin  → sees only grievances in THEIR village (was 'admin')
--   officer        → handles complaints in their village
--   citizen        → normal users
-- ============================================================================
