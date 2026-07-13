-- ============================================================================
-- GramSeva — 001_unified_database_setup.sql
-- Consolidated Zero-Recursion Schema and Service Layer Security Setup
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── 0. CLEANUP LEGACY DEPRECATED OBJECTS ───────────────────────────────────
DROP TABLE IF EXISTS public.village_memberships CASCADE;

-- Drop old triggers
DROP TRIGGER IF EXISTS tr_sync_profile_to_auth ON public.profiles;
DROP TRIGGER IF EXISTS tr_complaints_audit ON public.complaints;
DROP TRIGGER IF EXISTS tr_villages_audit ON public.villages;
DROP TRIGGER IF EXISTS tr_complaints_outbox ON public.complaints;
DROP TRIGGER IF EXISTS tr_villages_outbox ON public.villages;
-- Commented out due to schema auth permissions restrictions in SQL editor
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_complaints_modtime ON public.complaints;
DROP TRIGGER IF EXISTS tr_set_deadline ON public.complaints;
DROP TRIGGER IF EXISTS tr_notify_complaint ON public.complaints;
DROP TRIGGER IF EXISTS tr_set_complaint_village_id ON public.complaints;
DROP TRIGGER IF EXISTS tr_set_ratings_village ON public.complaint_ratings;
DROP TRIGGER IF EXISTS tr_set_upvotes_village ON public.complaint_upvotes;
DROP TRIGGER IF EXISTS tr_set_history_village ON public.complaint_history;
DROP TRIGGER IF EXISTS tr_set_notifications_village ON public.notifications;
DROP TRIGGER IF EXISTS block_insert ON public.complaints;
DROP TRIGGER IF EXISTS tr_block_complaints_insert ON public.complaints;

-- Drop old functions
-- Commented out recreated functions to avoid PostgreSQL dependency errors during migration.
-- DROP FUNCTION IF EXISTS public.sync_profile_to_auth_metadata();
DROP FUNCTION IF EXISTS public.get_my_role();
DROP FUNCTION IF EXISTS public.get_my_village();
-- DROP FUNCTION IF EXISTS public.sec_get_role();
-- DROP FUNCTION IF EXISTS public.sec_get_village();
-- DROP FUNCTION IF EXISTS public.is_owner(UUID);
-- DROP FUNCTION IF EXISTS public.get_current_profile_role(UUID);
-- DROP FUNCTION IF EXISTS public.get_current_profile_village(UUID);
-- DROP FUNCTION IF EXISTS public.get_current_village_sarpanch(BIGINT);
-- DROP FUNCTION IF EXISTS public.find_village_by_coords(NUMERIC, NUMERIC);
-- DROP FUNCTION IF EXISTS public.sec_get_complaint_citizen(UUID);
-- DROP FUNCTION IF EXISTS public.get_current_village_join_code(BIGINT);
-- DROP FUNCTION IF EXISTS public.get_current_village_name(BIGINT);
-- DROP FUNCTION IF EXISTS public.get_current_village_district(BIGINT);
-- DROP FUNCTION IF EXISTS public.get_current_village_state(BIGINT);
DROP FUNCTION IF EXISTS public.get_current_complaint_citizen(UUID);
-- DROP FUNCTION IF EXISTS public.generate_join_code();
DROP FUNCTION IF EXISTS public.approve_admin_request(BIGINT, UUID);
DROP FUNCTION IF EXISTS public.reject_admin_request(BIGINT, UUID);
DROP FUNCTION IF EXISTS public.join_village_by_code(TEXT);
-- DROP FUNCTION IF EXISTS public.log_complaint_audit();
-- DROP FUNCTION IF EXISTS public.log_village_audit();
-- Commented out to prevent dependency error from auth.users trigger
-- DROP FUNCTION IF EXISTS public.handle_new_user();
-- DROP FUNCTION IF EXISTS public.update_modified_column();
-- DROP FUNCTION IF EXISTS public.set_complaint_deadline();
-- DROP FUNCTION IF EXISTS public.escalate_overdue_complaints();
-- DROP FUNCTION IF EXISTS public.notify_complaint_update();
-- DROP FUNCTION IF EXISTS public.set_complaint_village_id();
-- DROP FUNCTION IF EXISTS public.set_child_village_id();
-- DROP FUNCTION IF EXISTS public.svc_join_village(TEXT);
-- DROP FUNCTION IF EXISTS public.svc_approve_admin_request(BIGINT, UUID);
-- DROP FUNCTION IF EXISTS public.svc_reject_admin_request(BIGINT, UUID);
-- DROP FUNCTION IF EXISTS public.svc_create_complaint(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB, JSONB, TEXT, BOOLEAN, TEXT, BIGINT);
-- DROP FUNCTION IF EXISTS public.queue_event();
-- DROP FUNCTION IF EXISTS public.prune_processed_outbox_events();
DROP FUNCTION IF EXISTS public.block_direct_complaints_insert();
DROP TABLE IF EXISTS public.outbox_events CASCADE;
-- DROP FUNCTION IF EXISTS public.check_rate_limit(TEXT, INT, INTERVAL);
DROP TABLE IF EXISTS public.rate_limits CASCADE;

-- ─── 1. CORE DATABASE TABLES SETUP ──────────────────────────────────────────

-- A. Villages table
CREATE TABLE IF NOT EXISTS public.villages (
    id BIGSERIAL PRIMARY KEY,
    village_name TEXT NOT NULL,
    district TEXT NOT NULL,
    state TEXT NOT NULL,
    join_code TEXT UNIQUE NOT NULL,
    sarpanch_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(village_name, district, state)
);

-- B. Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT,
    phone TEXT UNIQUE,
    role TEXT DEFAULT 'citizen',
    lang_pref TEXT DEFAULT 'en',
    village_id BIGINT REFERENCES public.villages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure village_id column exists on profiles (for upgrades)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS village_id BIGINT REFERENCES public.villages(id) ON DELETE SET NULL;

-- Apply role check constraint to profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('super_admin', 'district_admin', 'village_admin', 'officer', 'citizen'));

-- C. Complaints table
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'Open',
    citizen_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_officer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    photos JSONB DEFAULT '[]'::jsonb,
    photo_urls JSONB DEFAULT '[]'::jsonb,
    location TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    sla_deadline TIMESTAMPTZ,
    is_escalated BOOLEAN DEFAULT FALSE,
    priority TEXT CHECK (priority IN ('Urgent', NULL)),
    related_scheme TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    anonymous_phone TEXT,
    village_id BIGINT REFERENCES public.villages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    dedup_bucket BIGINT
);

-- Ensure village_id and dedup_bucket columns exist on complaints (for upgrades)
ALTER TABLE public.complaints
ADD COLUMN IF NOT EXISTS village_id BIGINT REFERENCES public.villages(id) ON DELETE SET NULL;

ALTER TABLE public.complaints
ADD COLUMN IF NOT EXISTS dedup_bucket BIGINT;

-- Backfill dedup_bucket for existing records
UPDATE public.complaints
SET dedup_bucket = floor(extract(epoch FROM created_at) / 300)
WHERE dedup_bucket IS NULL;

-- FIX 3: Database-enforced duplicate complaint prevention (concurrency-safe)
-- Deterministic fingerprint: same user + same title within 5-minute bucket
DROP INDEX IF EXISTS idx_complaints_dedup_fingerprint;
CREATE UNIQUE INDEX IF NOT EXISTS idx_complaints_dedup_fingerprint
ON public.complaints (
  citizen_id,
  md5(lower(trim(title))),
  dedup_bucket
)
WHERE citizen_id IS NOT NULL;

-- Apply status constraint to complaints
ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS complaints_status_check;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_status_check
    CHECK (status IN ('Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'));

-- D. Complaint History table (Tracks edits)
CREATE TABLE IF NOT EXISTS public.complaint_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    old_title TEXT,
    new_title TEXT,
    old_description TEXT,
    new_description TEXT,
    old_photo_urls JSONB DEFAULT '[]'::jsonb,
    new_photo_urls JSONB DEFAULT '[]'::jsonb,
    village_id BIGINT REFERENCES public.villages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.complaint_history
ADD COLUMN IF NOT EXISTS village_id BIGINT REFERENCES public.villages(id) ON DELETE CASCADE;

-- E. Complaint Ratings table (Feedback)
CREATE TABLE IF NOT EXISTS public.complaint_ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE NOT NULL,
    citizen_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    village_id BIGINT REFERENCES public.villages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(complaint_id, citizen_id)
);

ALTER TABLE public.complaint_ratings
ADD COLUMN IF NOT EXISTS village_id BIGINT REFERENCES public.villages(id) ON DELETE CASCADE;

-- F. Complaint Upvotes table (Community validation)
CREATE TABLE IF NOT EXISTS public.complaint_upvotes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    village_id BIGINT REFERENCES public.villages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(complaint_id, user_id)
);

ALTER TABLE public.complaint_upvotes
ADD COLUMN IF NOT EXISTS village_id BIGINT REFERENCES public.villages(id) ON DELETE CASCADE;

-- G. Village Boundaries table (GeoJSON overlays)
CREATE TABLE IF NOT EXISTS public.village_boundaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    geojson JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    village_id BIGINT REFERENCES public.villages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.village_boundaries
ADD COLUMN IF NOT EXISTS village_id BIGINT REFERENCES public.villages(id) ON DELETE CASCADE;

-- H. Admin Requests table (Promotion approvals)
CREATE TABLE IF NOT EXISTS public.admin_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT,
    village_name TEXT NOT NULL,
    district TEXT NOT NULL,
    state TEXT NOT NULL,
    proof_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Limit to 1 pending request per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_requests_pending_user
ON public.admin_requests(user_id)
WHERE status = 'pending';

-- I. Help Tickets table (User support)
CREATE TABLE IF NOT EXISTS public.help_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('request_admin', 'report_bug', 'feedback')),
    subject TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- J. Audit Logs table (Database operations)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT')),
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- K. Notifications table (SMS logs)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    provider TEXT DEFAULT 'mock',
    village_id BIGINT REFERENCES public.villages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS village_id BIGINT REFERENCES public.villages(id) ON DELETE CASCADE;

-- L. Outbox Events table (Transactional Outbox)
CREATE TABLE IF NOT EXISTS public.outbox_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL CHECK (event_type IN (
      'complaint.created', 'complaint.updated', 'complaint.modified', 'complaint.deleted',
      'village.created', 'village.updated', 'village.deleted',
      'audit.admin_request'
    )),
    event_key TEXT UNIQUE NOT NULL,
    payload JSONB NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    processed BOOLEAN DEFAULT FALSE NOT NULL,
    processed_at TIMESTAMPTZ,
    attempt_count INTEGER DEFAULT 0 NOT NULL,
    failed_reason TEXT
);

-- M. Rate Limits table
CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY,
    bucket_start TIMESTAMPTZ NOT NULL,
    request_count INT NOT NULL
);

-- ─── 2. CORE SECURITY FUNCTIONS (LOCK THIS FIRST) ───────────────────────────

-- Ownership explicitly pinned to postgres for ALL SECURITY DEFINER functions.
-- Prevents migration-user ownership drift.
-- Verified functions (30 total):
--   sec_get_role, sec_get_village, check_rate_limit, cleanup_rate_limits,
--   normalize_phone, get_current_profile_role, get_current_profile_village,
--   get_current_village_sarpanch, get_current_village_join_code,
--   get_current_village_name, get_current_village_district,
--   get_current_village_state, prune_processed_outbox_events, queue_event,
--   cleanup_outbox_events, log_complaint_audit, log_village_audit,
--   handle_new_user, update_modified_column, set_complaint_deadline,
--   set_complaint_village_id, notify_complaint_update, set_child_village_id,
--   sync_profile_to_auth_metadata, generate_join_code, svc_join_village,
--   svc_approve_admin_request, svc_reject_admin_request, svc_create_complaint,
--   escalate_overdue_complaints, auth.custom_access_token_hook

-- 🔐 2.1 Identity Resolver (ONLY TRUSTED ENTRY POINTS - ZERO RECURSION)
CREATE OR REPLACE FUNCTION public.sec_get_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = auth.uid()),
    'anon'
  );
$$;
ALTER FUNCTION public.sec_get_role() OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.sec_get_village()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (raw_app_meta_data ->> 'village_id')::BIGINT
  FROM auth.users
  WHERE id = auth.uid()
  LIMIT 1;
$$;
ALTER FUNCTION public.sec_get_village() OWNER TO postgres;

-- 🔐 2.1b District Resolver (reads district from auth.users metadata)
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

-- 🔐 2.1c District Village Checker (checks if village_id is in user's district)
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

-- FIX 2: Lock down SECURITY DEFINER functions — revoke PUBLIC, grant only to needed roles
REVOKE ALL ON FUNCTION public.sec_get_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sec_get_role() TO authenticated, anon, service_role;

REVOKE ALL ON FUNCTION public.sec_get_village() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sec_get_village() TO authenticated, anon, service_role;

REVOKE ALL ON FUNCTION public.sec_get_district() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sec_get_district() TO authenticated, anon, service_role;

REVOKE ALL ON FUNCTION public.sec_is_district_village(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sec_is_district_village(BIGINT) TO authenticated, service_role;

-- 🔐 2.1.5 Rate Limiter Helper (SAFETY RATING: HIGH)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_limit INT,
  p_window INTERVAL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_count INT;
BEGIN
  INSERT INTO public.rate_limits (key, bucket_start, request_count)
  VALUES (p_key, v_now, 1)
  ON CONFLICT (key) DO UPDATE
  SET
    bucket_start = CASE
      WHEN public.rate_limits.bucket_start + p_window < v_now THEN v_now
      ELSE public.rate_limits.bucket_start
    END,
    request_count = CASE
      WHEN public.rate_limits.bucket_start + p_window < v_now THEN 1
      ELSE LEAST(public.rate_limits.request_count + 1, p_limit + 1)
    END
  RETURNING request_count INTO v_count;

  -- FIX 6: Removed inline random() cleanup from request path.
  -- Use public.cleanup_rate_limits() via scheduled job instead.

  RETURN v_count <= p_limit;
END;
$$;
ALTER FUNCTION public.check_rate_limit(TEXT, INT, INTERVAL) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INT, INTERVAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INT, INTERVAL) FROM anon;
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INT, INTERVAL) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INTERVAL) TO service_role;

-- FIX 6: Dedicated cleanup function for expired rate-limit buckets
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.rate_limits
  WHERE bucket_start < now() - interval '2 hours';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
ALTER FUNCTION public.cleanup_rate_limits() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cleanup_rate_limits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limits() TO service_role;

-- FIX 5: Phone number normalization helper
CREATE OR REPLACE FUNCTION public.normalize_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  -- Strip all non-digit characters, then ensure +91 prefix for Indian numbers
  SELECT CASE
    WHEN regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^91[0-9]{10}$'
      THEN '+' || regexp_replace(p_phone, '[^0-9]', '', 'g')
    WHEN regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
      THEN '+91' || regexp_replace(p_phone, '[^0-9]', '', 'g')
    ELSE regexp_replace(p_phone, '[^0-9]', '', 'g')
  END;
$$;
ALTER FUNCTION public.normalize_phone(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.normalize_phone(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_phone(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.normalize_phone(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_phone(TEXT) TO service_role;

-- 🔐 2.2 Ownership helper (NO SUBQUERIES IN RLS ANYWHERE)
CREATE OR REPLACE FUNCTION public.is_owner(p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT p_user = auth.uid();
$$;

-- State-resolver helpers used strictly by trigger validations
CREATE OR REPLACE FUNCTION public.get_current_profile_role(p_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = p_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;
ALTER FUNCTION public.get_current_profile_role(UUID) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.get_current_profile_village(p_id UUID)
RETURNS BIGINT AS $$
  SELECT village_id FROM public.profiles WHERE id = p_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;
ALTER FUNCTION public.get_current_profile_village(UUID) OWNER TO postgres;

-- Helper to find active village boundary covering the given coordinates using PostGIS
CREATE OR REPLACE FUNCTION public.find_village_by_coords(
  p_lat NUMERIC,
  p_lng NUMERIC
)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_village_id BIGINT;
BEGIN
  SELECT village_id INTO v_village_id
  FROM public.village_boundaries
  WHERE is_active = TRUE
    AND ST_Within(
      ST_SetSRID(ST_Point(p_lng, p_lat), 4326),
      ST_GeomFromGeoJSON(COALESCE(geojson->'geometry', geojson))
    )
  LIMIT 1;

  RETURN v_village_id;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;
ALTER FUNCTION public.find_village_by_coords(NUMERIC, NUMERIC) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.find_village_by_coords(NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_village_by_coords(NUMERIC, NUMERIC) TO authenticated, anon, service_role;

-- Helper to get citizen_id of a complaint securely for RLS checks (no subqueries in RLS)
CREATE OR REPLACE FUNCTION public.sec_get_complaint_citizen(p_complaint_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT citizen_id FROM public.complaints WHERE id = p_complaint_id;
$$;
ALTER FUNCTION public.sec_get_complaint_citizen(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sec_get_complaint_citizen(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sec_get_complaint_citizen(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_current_village_sarpanch(p_id BIGINT)
RETURNS UUID AS $$
  SELECT sarpanch_user_id FROM public.villages WHERE id = p_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;
ALTER FUNCTION public.get_current_village_sarpanch(BIGINT) OWNER TO postgres;

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
     OR (public.sec_get_role() = 'district_admin' AND public.sec_is_district_village(p_id)) THEN
    RETURN (SELECT join_code FROM public.villages WHERE id = p_id);
  END IF;
  RETURN NULL;
END;
$$;
ALTER FUNCTION public.get_current_village_join_code(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_current_village_join_code(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_village_join_code(BIGINT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_current_village_name(p_id BIGINT)
RETURNS TEXT AS $$
  SELECT village_name FROM public.villages WHERE id = p_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;
ALTER FUNCTION public.get_current_village_name(BIGINT) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.get_current_village_district(p_id BIGINT)
RETURNS TEXT AS $$
  SELECT district FROM public.villages WHERE id = p_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;
ALTER FUNCTION public.get_current_village_district(BIGINT) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.get_current_village_state(p_id BIGINT)
RETURNS TEXT AS $$
  SELECT state FROM public.villages WHERE id = p_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;
ALTER FUNCTION public.get_current_village_state(BIGINT) OWNER TO postgres;

-- ─── 3. SYSTEM & AUDIT TRIGGER FUNCTIONS ─────────────────────────────────────

-- A. Outbox Pruning Function
CREATE OR REPLACE FUNCTION public.prune_processed_outbox_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.outbox_events
  WHERE processed = true
    AND created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;
ALTER FUNCTION public.prune_processed_outbox_events() OWNER TO postgres;

-- B. Generic Outbox Queue Trigger Function
CREATE OR REPLACE FUNCTION public.queue_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_type TEXT;
  v_event_key TEXT;
  v_payload JSONB;
BEGIN
  -- Determine event_type
  IF TG_TABLE_NAME = 'complaints' THEN
    IF TG_OP = 'INSERT' THEN
      v_event_type := 'complaint.created';
    ELSIF TG_OP = 'UPDATE' THEN
      v_event_type := 'complaint.updated';
    ELSIF TG_OP = 'DELETE' THEN
      v_event_type := 'complaint.deleted';
    END IF;
  ELSIF TG_TABLE_NAME = 'villages' THEN
    IF TG_OP = 'INSERT' THEN
      v_event_type := 'village.created';
    ELSIF TG_OP = 'UPDATE' THEN
      v_event_type := 'village.updated';
    ELSIF TG_OP = 'DELETE' THEN
      v_event_type := 'village.deleted';
    END IF;
  ELSE
    v_event_type := TG_TABLE_NAME || '.' || lower(TG_OP);
  END IF;

  -- Generate deterministic event_key via payload-based hash (stable under retry)
  v_event_key := md5(
    TG_TABLE_NAME || ':' ||
    COALESCE(NEW.id::text, OLD.id::text) || ':' ||
    TG_OP || ':' ||
    coalesce(
      md5(coalesce(to_jsonb(NEW)::text, '') || coalesce(to_jsonb(OLD)::text, '')),
      ''
    )
  );

  -- Payload contains OLD and NEW data
  v_payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'op', TG_OP,
    'old', CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    'new', CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
    'performed_by', auth.uid()
  );

  INSERT INTO public.outbox_events (event_type, event_key, payload)
  VALUES (v_event_type, v_event_key, v_payload)
  ON CONFLICT (event_key) DO NOTHING;

  -- FIX 2: Removed inline random() pruning from request path.
  -- Use public.cleanup_outbox_events() via scheduled job instead.

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;
ALTER FUNCTION public.queue_event() OWNER TO postgres;

-- FIX 2: Dedicated cleanup function for processed outbox events
CREATE OR REPLACE FUNCTION public.cleanup_outbox_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.outbox_events
  WHERE processed = true
    AND created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
ALTER FUNCTION public.cleanup_outbox_events() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cleanup_outbox_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_outbox_events() TO service_role;

-- C. Audit Trigger for Complaints
CREATE OR REPLACE FUNCTION public.log_complaint_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, performed_by, old_data, new_data)
    VALUES ('complaints', OLD.id::text, 'UPDATE', auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, performed_by, old_data, new_data)
    VALUES ('complaints', NEW.id::text, 'INSERT', auth.uid(), NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, performed_by, old_data, new_data)
    VALUES ('complaints', OLD.id::text, 'DELETE', auth.uid(), to_jsonb(OLD), NULL);
    RETURN OLD; -- MUST return OLD on delete to allow row removal
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION public.log_complaint_audit() OWNER TO postgres;

CREATE TRIGGER tr_complaints_audit
AFTER INSERT OR UPDATE OR DELETE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.log_complaint_audit();

-- D. Audit Trigger for Villages
CREATE OR REPLACE FUNCTION public.log_village_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, performed_by, old_data, new_data)
    VALUES ('villages', OLD.id::text, 'UPDATE', auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, performed_by, old_data, new_data)
    VALUES ('villages', NEW.id::text, 'INSERT', auth.uid(), NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, performed_by, old_data, new_data)
    VALUES ('villages', OLD.id::text, 'DELETE', auth.uid(), to_jsonb(OLD), NULL);
    RETURN OLD; -- MUST return OLD on delete to allow row removal
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION public.log_village_audit() OWNER TO postgres;

CREATE TRIGGER tr_villages_audit
AFTER INSERT OR UPDATE OR DELETE ON public.villages
FOR EACH ROW EXECUTE FUNCTION public.log_village_audit();

-- E. Auth Signup Trigger (Auto-creates profiles row)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, name, role)
  VALUES (
    new.id, 
    new.phone, 
    COALESCE(new.raw_user_meta_data->>'name', ''),
    'citizen'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Commented out due to schema auth permissions restrictions in SQL editor
-- CREATE TRIGGER on_auth_user_created
-- AFTER INSERT ON auth.users
-- FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- F. Modification time trigger for complaints
CREATE OR REPLACE FUNCTION public.update_modified_column() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION public.update_modified_column() OWNER TO postgres;

CREATE TRIGGER update_complaints_modtime
BEFORE UPDATE ON public.complaints
FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

-- G. SLA Default deadline setter
CREATE OR REPLACE FUNCTION public.set_complaint_deadline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sla_deadline IS NULL THEN
    NEW.sla_deadline := now() + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION public.set_complaint_deadline() OWNER TO postgres;

CREATE TRIGGER tr_set_deadline
BEFORE INSERT ON public.complaints
FOR EACH ROW EXECUTE PROCEDURE public.set_complaint_deadline();

CREATE OR REPLACE FUNCTION public.set_complaint_village_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Do NOT use profiles.village_id (sec_get_village) fallback anymore.
  -- If village_id is null, resolve using coordinates.
  IF TG_OP = 'INSERT' AND NEW.village_id IS NULL THEN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
      NEW.village_id := public.find_village_by_coords(NEW.latitude, NEW.longitude);
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.dedup_bucket := floor(extract(epoch FROM COALESCE(NEW.created_at, now())) / 300);
  END IF;

  RETURN NEW;
END;
$$;
ALTER FUNCTION public.set_complaint_village_id() OWNER TO postgres;

-- FIX 1: GUC-based insert bypass removed. Direct INSERT protection is now
-- enforced via REVOKE INSERT on complaints from authenticated/anon.
-- svc_create_complaint() runs as SECURITY DEFINER (postgres) and can still insert.
REVOKE INSERT ON public.complaints FROM authenticated, anon;
-- Note: postgres (owner) and service_role retain INSERT implicitly.

CREATE TRIGGER tr_set_complaint_village_id
BEFORE INSERT ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.set_complaint_village_id();

-- I. SMS Notification logging trigger
CREATE OR REPLACE FUNCTION public.notify_complaint_update()
RETURNS TRIGGER AS $$
DECLARE
  citizen_phone TEXT;
  msg TEXT;
BEGIN
  IF NEW.citizen_id IS NOT NULL THEN
    SELECT phone INTO citizen_phone FROM public.profiles WHERE id = NEW.citizen_id;
  END IF;

  IF citizen_phone IS NULL OR citizen_phone = '' THEN
    citizen_phone := NEW.anonymous_phone;
  END IF;

  IF citizen_phone IS NOT NULL AND citizen_phone <> '' THEN
    IF (TG_OP = 'INSERT') THEN
      msg := 'Namaste! Your grievance "' || NEW.title || '" has been registered. Ticket ID: ' || NEW.ticket_id || '. We will update you soon.';
      INSERT INTO public.notifications (complaint_id, recipient_phone, message, status)
      VALUES (NEW.id, citizen_phone, msg, 'sent');
    ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
      msg := 'Update: Your grievance (ID: ' || NEW.ticket_id || ') status changed to ' || NEW.status || '.';
      INSERT INTO public.notifications (complaint_id, recipient_phone, message, status)
      VALUES (NEW.id, citizen_phone, msg, 'sent');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_complaint_update() OWNER TO postgres;

CREATE TRIGGER tr_notify_complaint
AFTER INSERT OR UPDATE ON public.complaints
FOR EACH ROW EXECUTE PROCEDURE public.notify_complaint_update();

-- J. Automatic child village_id populating trigger (Zero-Recursion Enforcement)
CREATE OR REPLACE FUNCTION public.set_child_village_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT village_id INTO NEW.village_id
  FROM public.complaints
  WHERE id = NEW.complaint_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION public.set_child_village_id() OWNER TO postgres;

CREATE TRIGGER tr_set_ratings_village
BEFORE INSERT ON public.complaint_ratings
FOR EACH ROW EXECUTE FUNCTION public.set_child_village_id();

CREATE TRIGGER tr_set_upvotes_village
BEFORE INSERT ON public.complaint_upvotes
FOR EACH ROW EXECUTE FUNCTION public.set_child_village_id();

CREATE TRIGGER tr_set_history_village
BEFORE INSERT ON public.complaint_history
FOR EACH ROW EXECUTE FUNCTION public.set_child_village_id();

CREATE TRIGGER tr_set_notifications_village
BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.set_child_village_id();

-- Attach Outbox Triggers to Complaints and Villages
CREATE TRIGGER tr_complaints_outbox
AFTER INSERT OR UPDATE OR DELETE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.queue_event();

CREATE TRIGGER tr_villages_outbox
AFTER INSERT OR UPDATE OR DELETE ON public.villages
FOR EACH ROW EXECUTE FUNCTION public.queue_event();

-- K. Profiles trigger to sync role and village_id changes into raw_app_meta_data
CREATE OR REPLACE FUNCTION public.check_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Bypass role check if explicitly set by session configuration (e.g. from accept_invitation)
  IF current_setting('app.bypass_profile_role_check', true) = 'true' THEN
     RETURN NEW;
  END IF;

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

DROP TRIGGER IF EXISTS tr_check_profile_update ON public.profiles;
CREATE TRIGGER tr_check_profile_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.check_profile_update();

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

CREATE TRIGGER tr_sync_profile_to_auth
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_auth_metadata();

-- ─── 4. SERVICE LAYER ADMIN & ONBOARDING RPC FUNCTIONS ───────────────────────

-- A. Unique Join Code Generator helper
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    code := 'GSV' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    SELECT EXISTS(SELECT 1 FROM public.villages WHERE join_code = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_join_code() OWNER TO postgres;

-- B. Join Village Service RPC
CREATE OR REPLACE FUNCTION public.svc_join_village(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE 
  v_id BIGINT;
  v_name TEXT;
  v_current_village BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT village_id INTO v_current_village 
  FROM public.profiles 
  WHERE id = auth.uid() 
  FOR UPDATE;

  SELECT id, village_name INTO v_id, v_name
  FROM public.villages
  WHERE join_code = upper(p_code);

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid join code');
  END IF;

  IF v_current_village IS NOT NULL THEN
    IF v_current_village = v_id THEN
      RETURN jsonb_build_object('success', true, 'village_id', v_id, 'village_name', v_name);
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'You already belong to a different village');
    END IF;
  END IF;

  UPDATE public.profiles
  SET village_id = v_id
  WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true, 'village_id', v_id, 'village_name', v_name);
END;
$$;
ALTER FUNCTION public.svc_join_village(TEXT) OWNER TO postgres;

-- C. Approve Admin Request Service RPC
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
  -- Resolve reviewer ID via auth.uid() directly for security
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

-- D. Reject Admin Request Service RPC
CREATE OR REPLACE FUNCTION public.svc_reject_admin_request(
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
  v_reviewer_id UUID;
BEGIN
  -- Resolve reviewer ID via auth.uid() directly for security
  v_reviewer_id := auth.uid();
  IF v_reviewer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF public.sec_get_role() != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Only super_admin can reject requests.');
  END IF;

  SELECT * INTO v_request 
  FROM public.admin_requests 
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;

  UPDATE public.admin_requests
  SET status = 'rejected', reviewed_by = v_reviewer_id, reviewed_at = NOW()
  WHERE id = p_request_id;

  INSERT INTO public.audit_logs (table_name, record_id, action, performed_by, old_data, new_data)
  VALUES (
    'admin_requests',
    p_request_id::text,
    'REJECT',
    v_reviewer_id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'rejected')
  );

  RETURN jsonb_build_object('success', true);
END;
$$;
ALTER FUNCTION public.svc_reject_admin_request(BIGINT, UUID) OWNER TO postgres;

-- E. Create Complaint Service RPC (Primary Write Gateway)
CREATE OR REPLACE FUNCTION public.svc_create_complaint(
  p_title TEXT,
  p_description TEXT,
  p_category TEXT,
  p_location TEXT,
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_photos JSONB,
  p_photo_urls JSONB,
  p_related_scheme TEXT,
  p_is_anonymous BOOLEAN,
  p_anonymous_phone TEXT,
  p_village_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket_id TEXT;
  v_citizen_id UUID;
  v_village_id BIGINT;
  v_complaint_id UUID;
  v_constraint TEXT;
  v_exists BOOLEAN;
  v_attempts INTEGER := 0;
BEGIN
  -- ADD IDENTITY VALIDATION:
  IF auth.uid() IS NULL AND NOT p_is_anonymous THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid request');
  END IF;

  -- A. Authenticated request rate limiting (FIX 3: namespaced key)
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.check_rate_limit(
      'complaint_request:' || auth.uid()::text,
      20,
      interval '1 hour'
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Rate limit exceeded'
      );
    END IF;
  END IF;

  -- B. Authenticated complaint creation budget (FIX 4: atomic via check_rate_limit)
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.check_rate_limit(
      'complaint_budget:' || auth.uid()::text,
      5,
      interval '1 hour'
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Hourly limit exceeded'
      );
    END IF;
  END IF;

  -- C. Anonymous complaint limit (FIX 5: normalized phone, FIX 3: namespaced key)
  IF p_is_anonymous THEN
    IF NOT public.check_rate_limit(
      'anonymous_phone:' || public.normalize_phone(COALESCE(p_anonymous_phone, '')),
      3,
      interval '1 hour'
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Too many anonymous reports'
      );
    END IF;
  END IF;

  -- 1. Resolve identity
  IF auth.uid() IS NOT NULL THEN
    v_citizen_id := auth.uid();
  ELSE
    v_citizen_id := NULL;
  END IF;

  -- 2. Resolve target village
  v_village_id := NULL;

  -- Try geographic lookup if coordinates are provided
  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    v_village_id := public.find_village_by_coords(p_latitude, p_longitude);
  END IF;

  -- Fall back to p_village_id if geographic lookup did not resolve
  IF v_village_id IS NULL AND p_village_id IS NOT NULL THEN
    SELECT id INTO v_village_id FROM public.villages WHERE id = p_village_id;
  END IF;

  -- Validate resolved/supplied village_id exists
  IF v_village_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid village');
  END IF;

  -- 2. Generate unique Ticket ID with collision loop & safety cap
  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      RAISE EXCEPTION 'Unable to generate unique ticket ID';
    END IF;

    v_ticket_id := 'VGS-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    SELECT EXISTS(SELECT 1 FROM public.complaints WHERE ticket_id = v_ticket_id) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  -- 3. Perform insert directly into public.complaints
  INSERT INTO public.complaints (
    ticket_id, title, description, category, status,
    citizen_id, photos, photo_urls, location, latitude, longitude,
    is_anonymous, anonymous_phone, village_id
  )
  VALUES (
    v_ticket_id, p_title, p_description, p_category, 'Open',
    v_citizen_id, p_photos, p_photo_urls, p_location, p_latitude, p_longitude,
    p_is_anonymous, p_anonymous_phone, v_village_id
  )
  RETURNING id INTO v_complaint_id;

  RETURN jsonb_build_object(
    'success', true,
    'complaint_id', v_complaint_id,
    'ticket_id', v_ticket_id
  );
EXCEPTION
  WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'idx_complaints_dedup_fingerprint' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Duplicate complaint detected. Please wait before retrying.');
    END IF;
    -- Re-raise for unrelated unique violations (ticket_id, etc.)
    RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
ALTER FUNCTION public.svc_create_complaint(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB, JSONB, TEXT, BOOLEAN, TEXT, BIGINT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.svc_create_complaint TO authenticated, anon;

-- F. Escalate Overdue Complaints RPC
CREATE OR REPLACE FUNCTION public.escalate_overdue_complaints()
RETURNS void AS $$
BEGIN
  UPDATE public.complaints
  SET 
    is_escalated = TRUE,
    status = 'In Progress'
  WHERE 
    status IN ('Open', 'Assigned') 
    AND sla_deadline < now()
    AND is_escalated = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION public.escalate_overdue_complaints() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.escalate_overdue_complaints() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.escalate_overdue_complaints() TO service_role;

-- G. Supabase Custom Access Token Hook to inject claims dynamically (Disabled for standard SQL Editor permissions)
-- CREATE OR REPLACE FUNCTION auth.custom_access_token_hook(event jsonb)
-- RETURNS jsonb
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public, auth, pg_temp
-- AS $$
-- DECLARE
--   v_role text;
--   v_village_id bigint;
--   v_claims jsonb;
-- BEGIN
--   -- Fetch current state from profiles table
--   SELECT role, village_id INTO v_role, v_village_id
--   FROM public.profiles
--   WHERE id = (event ->> 'user_id')::uuid;
-- 
--   v_claims := event -> 'claims';
--   
--   -- Inject roles and village_id into the JWT claims
--   v_claims := jsonb_set(v_claims, '{role}', to_jsonb(coalesce(v_role, 'citizen')));
--   v_claims := jsonb_set(v_claims, '{village_id}', to_jsonb(v_village_id));
-- 
--   event := jsonb_set(event, '{claims}', v_claims);
--   RETURN event;
-- END;
-- $$;
-- ALTER FUNCTION auth.custom_access_token_hook(jsonb) OWNER TO postgres;
-- 
-- -- Grant execution to supabase_auth_admin
-- GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
-- GRANT EXECUTE ON FUNCTION auth.custom_access_token_hook TO supabase_auth_admin;
-- REVOKE ALL ON FUNCTION auth.custom_access_token_hook FROM PUBLIC;

-- ─── 5. ROW LEVEL SECURITY (RLS) SYSTEM (ZERO RECURSION ENFORCED) ────────────

-- Enable RLS on all tables
ALTER TABLE public.villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.village_boundaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- ─── 5.1 VILLAGES POLICIES ───
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

-- ─── 5.2 PROFILES POLICIES ───
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

-- ─── 5.3 COMPLAINTS POLICIES ───
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

DROP POLICY IF EXISTS "complaints_insert" ON public.complaints;
-- Insert policies are completely deleted to block direct writes.
-- All inserts MUST go through public.svc_create_complaint RPC.

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

-- ─── 5.4 COMPLAINT HISTORY POLICIES ───
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

-- ─── 5.5 COMPLAINT RATINGS POLICIES ───
DROP POLICY IF EXISTS "ratings_select" ON public.complaint_ratings;
CREATE POLICY "ratings_select" ON public.complaint_ratings
FOR SELECT USING (
  public.sec_get_role() = 'super_admin'
  OR village_id = public.sec_get_village()
  OR citizen_id = auth.uid()
  OR public.sec_get_complaint_citizen(complaint_id) = auth.uid()
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

-- ─── 5.6 COMPLAINT UPVOTES POLICIES ───
DROP POLICY IF EXISTS "upvotes_select" ON public.complaint_upvotes;
CREATE POLICY "upvotes_select" ON public.complaint_upvotes
FOR SELECT USING (
  public.sec_get_role() = 'super_admin'
  OR village_id = public.sec_get_village()
  OR user_id = auth.uid()
  OR public.sec_get_complaint_citizen(complaint_id) = auth.uid()
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

-- ─── 5.7 VILLAGE BOUNDARIES POLICIES ───
DROP POLICY IF EXISTS "boundaries_select" ON public.village_boundaries;
CREATE POLICY "boundaries_select" ON public.village_boundaries
FOR SELECT USING (TRUE); -- Publicly viewable for LocationPicker boundary check

DROP POLICY IF EXISTS "boundaries_modify" ON public.village_boundaries;
CREATE POLICY "boundaries_modify" ON public.village_boundaries
FOR ALL USING (
  public.sec_get_role() = 'super_admin'
);

-- ─── 5.8 ADMIN REQUESTS POLICIES ───
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

-- ─── 5.9 HELP TICKETS POLICIES ───
DROP POLICY IF EXISTS "help_tickets_select" ON public.help_tickets;
CREATE POLICY "help_tickets_select" ON public.help_tickets
FOR SELECT USING (
  user_id = auth.uid()
  OR public.sec_get_role() = 'super_admin'
);

DROP POLICY IF EXISTS "help_tickets_insert" ON public.help_tickets;
CREATE POLICY "help_tickets_insert" ON public.help_tickets
FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

-- ─── 5.10 AUDIT LOGS POLICIES ───
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs
FOR SELECT USING (
  public.sec_get_role() = 'super_admin'
);

-- ─── 5.11 NOTIFICATIONS POLICIES ───
-- Only Super Admins can select notifications directly (others track via push/SMS)
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications
FOR SELECT USING (
  public.sec_get_role() = 'super_admin'
);

-- ─── 5.12 OUTBOX EVENTS POLICIES ───
-- Only Super Admins can select outbox events directly
DROP POLICY IF EXISTS "outbox_events_select" ON public.outbox_events;
CREATE POLICY "outbox_events_select" ON public.outbox_events
FOR SELECT USING (
  public.sec_get_role() = 'super_admin'
);

-- ─── 6. STORAGE BUCKETS AND SECURITY POLICIES ────────────────────────────────

-- Evidence storage path format:
-- {user_uuid}/{complaint_uuid}/{filename}
--
-- Required for:
--   * ownership enforcement
--   * village-level authorization
--   * officer/admin access controls
--
-- Changing this path format requires updating
-- can_read_complaint_evidence().
CREATE OR REPLACE FUNCTION public.is_valid_evidence_path(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parts TEXT[];
  v_complaint_id UUID;
BEGIN
  -- Split path into segments
  v_parts := string_to_array(p_object_name, '/');

  -- Path must contain at least 3 segments
  IF v_parts IS NULL OR array_length(v_parts, 1) < 3 THEN
    RETURN FALSE;
  END IF;

  -- Segment 1 must equal auth.uid()
  IF v_parts[1] IS NULL OR auth.uid() IS NULL OR v_parts[1] != auth.uid()::TEXT THEN
    RETURN FALSE;
  END IF;

  -- Segment 2 must be a valid UUID
  BEGIN
    v_complaint_id := v_parts[2]::UUID;
    IF v_complaint_id IS NULL THEN
      RETURN FALSE;
    END IF;
  EXCEPTION WHEN others THEN
    RETURN FALSE;
  END;

  -- Filename segment must not be empty
  IF v_parts[3] IS NULL OR trim(v_parts[3]) = '' THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
EXCEPTION WHEN others THEN
  RETURN FALSE;
END;
$$;
ALTER FUNCTION public.is_valid_evidence_path(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_valid_evidence_path(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_valid_evidence_path(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.is_valid_evidence_path(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_evidence_path(TEXT) TO authenticated, service_role;

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

-- Setup admin-proofs bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-proofs', 'admin-proofs', false)
ON CONFLICT (id) DO NOTHING;

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

-- Setup complaint-evidence bucket (private — evidence may contain PII)
INSERT INTO storage.buckets (id, name, public)
VALUES ('complaint-evidence', 'complaint-evidence', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Public complaint evidence read access" ON storage.objects;
DROP POLICY IF EXISTS "Complaint evidence read access" ON storage.objects;
CREATE POLICY "Complaint evidence read access" ON storage.objects
FOR SELECT USING (
  bucket_id = 'complaint-evidence'
  AND public.can_read_complaint_evidence(name)
);

DROP POLICY IF EXISTS "Users can upload complaint evidence" ON storage.objects;
CREATE POLICY "Users can upload complaint evidence" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'complaint-evidence'
  AND auth.role() = 'authenticated'
  AND public.is_valid_evidence_path(name)
);

DROP POLICY IF EXISTS "Users can delete complaint evidence" ON storage.objects;
CREATE POLICY "Users can delete complaint evidence" ON storage.objects
FOR DELETE USING (
  bucket_id = 'complaint-evidence'
  AND auth.role() = 'authenticated'
  AND starts_with(name, auth.uid()::text || '/')
);

-- ─── 7. PERFORMANCE OPTIMIZED INDEXES ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_village ON public.profiles(village_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_villages_join_code ON public.villages(join_code);
CREATE INDEX IF NOT EXISTS idx_admin_requests_status ON public.admin_requests(status);
CREATE INDEX IF NOT EXISTS idx_admin_requests_user ON public.admin_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_help_tickets_user ON public.help_tickets(user_id);

-- Complaint performance indexes (Critical at 10M scale)
DROP INDEX IF EXISTS idx_complaints_village;
DROP INDEX IF EXISTS idx_complaints_village_created;
CREATE INDEX IF NOT EXISTS idx_complaints_village_created ON public.complaints(village_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_citizen_village ON public.complaints(citizen_id, village_id);
CREATE INDEX IF NOT EXISTS idx_complaints_village_status ON public.complaints(village_id, status);
CREATE INDEX IF NOT EXISTS idx_complaints_village_status_created ON public.complaints(village_id, status, created_at DESC);

-- Child table performance indexes
CREATE INDEX IF NOT EXISTS idx_complaint_history_complaint ON public.complaint_history(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_ratings_complaint ON public.complaint_ratings(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_upvotes_complaint ON public.complaint_upvotes(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_history_village ON public.complaint_history(village_id);
CREATE INDEX IF NOT EXISTS idx_complaint_ratings_village ON public.complaint_ratings(village_id);
CREATE INDEX IF NOT EXISTS idx_complaint_upvotes_village ON public.complaint_upvotes(village_id);

-- Event outbox performance indexes
CREATE INDEX IF NOT EXISTS idx_outbox_events_processed_created ON public.outbox_events(processed, created_at);

-- Rate limit performance index (FIX 7: verified)
CREATE INDEX IF NOT EXISTS idx_rate_limits_bucket_start ON public.rate_limits(bucket_start);

-- FIX 7: Additional supporting indexes for complaint budget and anonymous checks
CREATE INDEX IF NOT EXISTS idx_complaints_citizen_created ON public.complaints(citizen_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_anon_phone_created ON public.complaints(anonymous_phone, created_at DESC)
  WHERE anonymous_phone IS NOT NULL;



