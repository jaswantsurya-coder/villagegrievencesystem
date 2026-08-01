-- ============================================================================
-- GramSeva — 014_admin_request_portal_integration.sql
-- Admin Request Portal ↔ Super Admin Dashboard Integration
-- Enhances admin_requests, creates sa_notifications, triggers, RLS, Realtime
-- ============================================================================

-- ─── 1. ENHANCE admin_requests TABLE ────────────────────────────────────────

-- Add new columns for complete application data
ALTER TABLE public.admin_requests
  ADD COLUMN IF NOT EXISTS request_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS mandal TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS aadhaar_number TEXT,
  ADD COLUMN IF NOT EXISTS government_id_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS invitation_token TEXT,
  ADD COLUMN IF NOT EXISTS invitation_url TEXT;

-- Create a sequence for auto-incrementing request IDs
CREATE SEQUENCE IF NOT EXISTS public.admin_request_id_seq START WITH 1 INCREMENT BY 1;

-- Index on request_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_admin_requests_request_id
ON public.admin_requests(request_id);

-- Index on status for filtering
CREATE INDEX IF NOT EXISTS idx_admin_requests_status
ON public.admin_requests(status);

-- Index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_admin_requests_created_at
ON public.admin_requests(created_at DESC);

-- ─── 2. AUTO-GENERATE request_id TRIGGER ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_admin_request_id()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_num INT;
  new_request_id TEXT;
BEGIN
  -- Only generate if request_id is not already set
  IF NEW.request_id IS NULL OR NEW.request_id = '' THEN
    year_part := EXTRACT(YEAR FROM COALESCE(NEW.created_at, NOW()))::TEXT;
    seq_num := nextval('public.admin_request_id_seq');
    new_request_id := 'ADM-' || year_part || '-' || LPAD(seq_num::TEXT, 6, '0');
    NEW.request_id := new_request_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_admin_request_id() OWNER TO postgres;

DROP TRIGGER IF EXISTS tr_admin_request_generate_id ON public.admin_requests;
CREATE TRIGGER tr_admin_request_generate_id
BEFORE INSERT ON public.admin_requests
FOR EACH ROW EXECUTE FUNCTION public.generate_admin_request_id();

-- ─── 3. SA_NOTIFICATIONS TABLE (Super Admin Notification Center) ────────────

CREATE TABLE IF NOT EXISTS public.sa_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'system' CHECK (type IN (
        'admin_request', 'approval', 'rejection', 'system', 'alert'
    )),
    is_read BOOLEAN DEFAULT FALSE,
    link_path TEXT,                    -- e.g. '/approvals' or '/approvals?id=xxx'
    related_request_id UUID,          -- FK to admin_requests.id
    icon TEXT DEFAULT 'bell',         -- lucide icon name hint
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notification center
CREATE INDEX IF NOT EXISTS idx_sa_notifications_is_read
ON public.sa_notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_sa_notifications_created_at
ON public.sa_notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sa_notifications_type
ON public.sa_notifications(type);

-- ─── 4. AUTO-CREATE NOTIFICATION ON NEW ADMIN REQUEST ───────────────────────

CREATE OR REPLACE FUNCTION public.on_admin_request_insert_notify()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.sa_notifications (
    title,
    message,
    type,
    is_read,
    link_path,
    related_request_id,
    icon
  ) VALUES (
    '🔔 New Village Admin Request',
    COALESCE(NEW.full_name, 'An applicant') || ' has requested Village Administrator access for ' || COALESCE(NEW.village_name, 'a village') || '.',
    'admin_request',
    FALSE,
    '/approvals',
    NEW.id,
    'file-check-2'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION public.on_admin_request_insert_notify() OWNER TO postgres;

DROP TRIGGER IF EXISTS tr_admin_request_notify ON public.admin_requests;
CREATE TRIGGER tr_admin_request_notify
AFTER INSERT ON public.admin_requests
FOR EACH ROW EXECUTE FUNCTION public.on_admin_request_insert_notify();

-- ─── 5. AUTO-CREATE NOTIFICATION ON APPROVAL/REJECTION ──────────────────────

CREATE OR REPLACE FUNCTION public.on_admin_request_status_change_notify()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.sa_notifications (title, message, type, link_path, related_request_id, icon)
      VALUES (
        '✅ Village Administrator Approved',
        COALESCE(NEW.full_name, 'Applicant') || ' has been approved as Village Administrator for ' || COALESCE(NEW.village_name, 'a village') || '.',
        'approval',
        '/approvals',
        NEW.id,
        'check-circle-2'
      );
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.sa_notifications (title, message, type, link_path, related_request_id, icon)
      VALUES (
        '❌ Village Admin Request Rejected',
        'Request from ' || COALESCE(NEW.full_name, 'Applicant') || ' for ' || COALESCE(NEW.village_name, 'a village') || ' has been rejected.',
        'rejection',
        '/approvals',
        NEW.id,
        'x-circle'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION public.on_admin_request_status_change_notify() OWNER TO postgres;

DROP TRIGGER IF EXISTS tr_admin_request_status_change ON public.admin_requests;
CREATE TRIGGER tr_admin_request_status_change
AFTER UPDATE ON public.admin_requests
FOR EACH ROW EXECUTE FUNCTION public.on_admin_request_status_change_notify();

-- ─── 6. ROW LEVEL SECURITY ─────────────────────────────────────────────────

-- admin_requests RLS
ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;

-- Allow anyone to INSERT (portal submissions come unauthenticated or with anon key)
DROP POLICY IF EXISTS admin_requests_insert_policy ON public.admin_requests;
CREATE POLICY admin_requests_insert_policy ON public.admin_requests
  FOR INSERT WITH CHECK (true);

-- Only authenticated users can SELECT
DROP POLICY IF EXISTS admin_requests_select_policy ON public.admin_requests;
CREATE POLICY admin_requests_select_policy ON public.admin_requests
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only authenticated users can UPDATE
DROP POLICY IF EXISTS admin_requests_update_policy ON public.admin_requests;
CREATE POLICY admin_requests_update_policy ON public.admin_requests
  FOR UPDATE USING (auth.role() = 'authenticated');

-- sa_notifications RLS
ALTER TABLE public.sa_notifications ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read notifications
DROP POLICY IF EXISTS sa_notifications_select_policy ON public.sa_notifications;
CREATE POLICY sa_notifications_select_policy ON public.sa_notifications
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only authenticated users can update (mark as read)
DROP POLICY IF EXISTS sa_notifications_update_policy ON public.sa_notifications;
CREATE POLICY sa_notifications_update_policy ON public.sa_notifications
  FOR UPDATE USING (auth.role() = 'authenticated');

-- System (triggers) can insert via SECURITY DEFINER functions
DROP POLICY IF EXISTS sa_notifications_insert_policy ON public.sa_notifications;
CREATE POLICY sa_notifications_insert_policy ON public.sa_notifications
  FOR INSERT WITH CHECK (true);

-- ─── 7. ENABLE SUPABASE REALTIME ────────────────────────────────────────────

-- Enable realtime for admin_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_requests;

-- Enable realtime for sa_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.sa_notifications;

-- ─── 8. BACKFILL: Generate request_ids for existing rows ────────────────────

DO $$
DECLARE
  r RECORD;
  year_part TEXT;
  seq_num INT;
BEGIN
  FOR r IN
    SELECT id, created_at FROM public.admin_requests
    WHERE request_id IS NULL
    ORDER BY created_at ASC
  LOOP
    year_part := EXTRACT(YEAR FROM COALESCE(r.created_at, NOW()))::TEXT;
    seq_num := nextval('public.admin_request_id_seq');
    UPDATE public.admin_requests
    SET request_id = 'ADM-' || year_part || '-' || LPAD(seq_num::TEXT, 6, '0')
    WHERE id = r.id;
  END LOOP;
END $$;

-- ============================================================================
-- DONE — Run this against sompzqwvegygtpsrlhzt (Primary Supabase)
-- ============================================================================
