-- ============================================================================
-- GramSeva — 013_notification_tokens_and_queue.sql
-- Phase-2: FCM Push Notification Tokens, Unified Notification Queue,
--          Escalation Logs, and Anonymous Users
-- ============================================================================

-- ─── 1. NOTIFICATION TOKENS TABLE (FCM Device Tokens) ───────────────────────

CREATE TABLE IF NOT EXISTS public.notification_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT,
    village_id BIGINT REFERENCES public.villages(id) ON DELETE SET NULL,
    fcm_token TEXT NOT NULL,
    browser TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure one user has only one active token per browser
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_tokens_user_browser
ON public.notification_tokens(user_id, browser);

-- Fast lookup by FCM token for invalidation
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_tokens_fcm_token
ON public.notification_tokens(fcm_token);

-- Fast lookup by village for broadcasting
CREATE INDEX IF NOT EXISTS idx_notification_tokens_village
ON public.notification_tokens(village_id);

-- Fast lookup by role for targeted notifications
CREATE INDEX IF NOT EXISTS idx_notification_tokens_role
ON public.notification_tokens(role);

-- Auto-update updated_at on token changes
CREATE OR REPLACE FUNCTION public.update_notification_token_modtime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION public.update_notification_token_modtime() OWNER TO postgres;

DROP TRIGGER IF EXISTS tr_notification_tokens_modtime ON public.notification_tokens;
CREATE TRIGGER tr_notification_tokens_modtime
BEFORE UPDATE ON public.notification_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_notification_token_modtime();

-- ─── 2. NOTIFICATION QUEUE TABLE (Unified Delivery Queue) ───────────────────

CREATE TABLE IF NOT EXISTS public.notification_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    notification_type TEXT NOT NULL CHECK (notification_type IN (
        'complaint_submitted', 'complaint_assigned', 'complaint_updated',
        'complaint_resolved', 'complaint_rejected', 'complaint_reopened',
        'complaint_escalated',
        'admin_request_submitted', 'admin_request_approved', 'admin_request_rejected',
        'help_ticket_new',
        'otp_verification',
        'profile_update',
        'terms_update', 'privacy_update',
        'maintenance_notice', 'announcement',
        'escalation_reminder'
    )),
    channel TEXT NOT NULL CHECK (channel IN ('push', 'email', 'whatsapp', 'sms')),
    recipient_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recipient_identifier TEXT,  -- email address, phone number, or push endpoint
    subject TEXT,
    body_text TEXT NOT NULL,
    body_html TEXT,             -- HTML body for email channel
    payload JSONB DEFAULT '{}'::jsonb, -- complaint_id, village_id, ticket_id, action_url, etc.
    status TEXT DEFAULT 'queued' CHECK (status IN (
        'queued', 'processing', 'sent', 'delivered', 'failed', 'bounced', 'skipped'
    )),
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    error_message TEXT,
    external_id TEXT,           -- Brevo message ID, FCM message ID, etc.
    village_id BIGINT REFERENCES public.villages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ
);

-- Performance indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_nq_status_retry
ON public.notification_queue(status, next_retry_at)
WHERE status IN ('queued', 'failed');

CREATE INDEX IF NOT EXISTS idx_nq_recipient_user
ON public.notification_queue(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nq_village
ON public.notification_queue(village_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nq_type_created
ON public.notification_queue(notification_type, created_at DESC);

-- ─── 3. ESCALATION LOGS TABLE ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.escalation_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    escalated_at TIMESTAMPTZ DEFAULT NOW(),
    escalation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    escalation_reason TEXT DEFAULT '7-day no update',
    notified_roles JSONB DEFAULT '[]'::jsonb,
    notification_ids JSONB DEFAULT '[]'::jsonb,
    village_id BIGINT REFERENCES public.villages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate escalation of same complaint within 24 hours
CREATE UNIQUE INDEX IF NOT EXISTS idx_escalation_logs_daily_dedup
ON public.escalation_logs(complaint_id, escalation_date);

CREATE INDEX IF NOT EXISTS idx_escalation_logs_complaint
ON public.escalation_logs(complaint_id, escalated_at DESC);

CREATE INDEX IF NOT EXISTS idx_escalation_logs_village
ON public.escalation_logs(village_id, escalated_at DESC);

-- ─── 4. ANONYMOUS USERS TABLE ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.anonymous_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    anonymous_id TEXT UNIQUE NOT NULL,           -- ANON-2026-000001 format
    phone TEXT NOT NULL,
    email TEXT,
    district TEXT,
    village_name TEXT,
    village_id BIGINT REFERENCES public.villages(id) ON DELETE SET NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    otp_hash TEXT,
    otp_expires_at TIMESTAMPTZ,
    otp_attempts INT DEFAULT 0,
    complaint_count INT DEFAULT 0,
    last_complaint_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anonymous_users_phone
ON public.anonymous_users(phone);

CREATE INDEX IF NOT EXISTS idx_anonymous_users_anon_id
ON public.anonymous_users(anonymous_id);

CREATE INDEX IF NOT EXISTS idx_anonymous_users_village
ON public.anonymous_users(village_id);

-- ─── 5. ANONYMOUS COMPLAINT LINK TABLE ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.anonymous_complaint_link (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    anonymous_user_id UUID NOT NULL REFERENCES public.anonymous_users(id) ON DELETE CASCADE,
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(anonymous_user_id, complaint_id)
);

CREATE INDEX IF NOT EXISTS idx_acl_anon_user
ON public.anonymous_complaint_link(anonymous_user_id);

CREATE INDEX IF NOT EXISTS idx_acl_complaint
ON public.anonymous_complaint_link(complaint_id);

-- ─── 6. ADD NEW COLUMNS TO COMPLAINTS ───────────────────────────────────────

ALTER TABLE public.complaints
ADD COLUMN IF NOT EXISTS anonymous_user_id UUID REFERENCES public.anonymous_users(id) ON DELETE SET NULL;

ALTER TABLE public.complaints
ADD COLUMN IF NOT EXISTS escalation_count INT DEFAULT 0;

-- ─── 7. ANONYMOUS ID SEQUENCE GENERATOR ─────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.anonymous_id_seq START 1;

CREATE OR REPLACE FUNCTION public.svc_generate_anonymous_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_year TEXT;
    v_seq INT;
BEGIN
    v_year := to_char(NOW(), 'YYYY');
    v_seq := nextval('public.anonymous_id_seq');
    RETURN 'ANON-' || v_year || '-' || lpad(v_seq::text, 6, '0');
END;
$$;
ALTER FUNCTION public.svc_generate_anonymous_id() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.svc_generate_anonymous_id() TO service_role;

-- ─── 8. VILLAGE ADMIN EXISTENCE CHECKER ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.svc_verify_village_admin_exists(
    p_village_name TEXT,
    p_district TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_village public.villages%ROWTYPE;
BEGIN
    SELECT * INTO v_village
    FROM public.villages
    WHERE lower(trim(village_name)) = lower(trim(p_village_name))
      AND lower(trim(district)) = lower(trim(p_district))
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'exists', false,
            'has_admin', false,
            'message', 'Village not found in our records'
        );
    END IF;

    IF v_village.sarpanch_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'exists', true,
            'has_admin', false,
            'village_id', v_village.id,
            'message', 'No registered administrator for this village. Complaint submission is not available.'
        );
    END IF;

    RETURN jsonb_build_object(
        'exists', true,
        'has_admin', true,
        'village_id', v_village.id,
        'village_name', v_village.village_name,
        'district', v_village.district
    );
END;
$$;
ALTER FUNCTION public.svc_verify_village_admin_exists(TEXT, TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.svc_verify_village_admin_exists(TEXT, TEXT) TO service_role, anon, authenticated;

-- ─── 9. STALE COMPLAINT ESCALATION FUNCTION ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.svc_escalate_stale_complaints()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_complaint RECORD;
    v_admin_email TEXT;
    v_admin_name TEXT;
    v_village_name TEXT;
    v_district TEXT;
    v_escalated_count INT := 0;
    v_today DATE := CURRENT_DATE;
BEGIN
    FOR v_complaint IN
        SELECT c.id, c.ticket_id, c.title, c.village_id, c.status, c.updated_at
        FROM public.complaints c
        WHERE c.status IN ('Open', 'Assigned', 'In Progress')
          AND c.updated_at < NOW() - INTERVAL '7 days'
          AND c.is_escalated = FALSE
          AND NOT EXISTS (
              SELECT 1 FROM public.escalation_logs el
              WHERE el.complaint_id = c.id
                AND el.escalation_date = v_today
          )
    LOOP
        -- Mark complaint as escalated
        UPDATE public.complaints
        SET is_escalated = TRUE,
            escalation_count = COALESCE(escalation_count, 0) + 1
        WHERE id = v_complaint.id;

        -- Fetch Village Admin (Sarpanch) email and details from DB
        SELECT p.email, COALESCE(p.name, p.full_name, 'Village Admin'), v.village_name, v.district
        INTO v_admin_email, v_admin_name, v_village_name, v_district
        FROM public.villages v
        JOIN public.profiles p ON p.id = v.sarpanch_user_id
        WHERE v.id = v_complaint.village_id
        LIMIT 1;

        -- Log escalation
        INSERT INTO public.escalation_logs (
            complaint_id, escalated_at, escalation_date, escalation_reason,
            notified_roles, village_id
        ) VALUES (
            v_complaint.id, NOW(), v_today, '7-day no update',
            '["village_admin", "officer", "super_admin"]'::jsonb, v_complaint.village_id
        );

        -- Enqueue FCM Web Push Notification
        INSERT INTO public.notification_queue (
            notification_type, channel, recipient_identifier, subject, body_text, village_id, payload
        ) VALUES (
            'complaint_escalated', 'push', v_admin_email,
            '🚨 7-Day Unresolved Grievance Alert #' || COALESCE(v_complaint.ticket_id, 'VGS-1001'),
            'Complaint "' || v_complaint.title || '" has been unresolved for 7 days in ' || COALESCE(v_village_name, 'Panchayat'),
            v_complaint.village_id,
            jsonb_build_object('complaint_id', v_complaint.id, 'ticket_id', v_complaint.ticket_id, 'days_stale', 7)
        );

        -- Enqueue Brevo Transactional Email (pushed to Admin Email stored in DB)
        IF v_admin_email IS NOT NULL AND v_admin_email != '' THEN
            INSERT INTO public.notification_queue (
                notification_type, channel, recipient_identifier, subject, body_text, village_id, payload
            ) VALUES (
                'complaint_escalated', 'email', v_admin_email,
                '🚨 SLA Escalation Alert: Complaint #' || COALESCE(v_complaint.ticket_id, 'VGS-1001') || ' Unresolved for 7 Days',
                'Dear ' || v_admin_name || ', a citizen complaint in ' || COALESCE(v_village_name, 'Panchayat') || ' (' || COALESCE(v_district, '') || ') has remained unresolved for 7 consecutive days without status updates.',
                v_complaint.village_id,
                jsonb_build_object(
                    'admin_email', v_admin_email,
                    'admin_name', v_admin_name,
                    'ticket_number', v_complaint.ticket_id,
                    'title', v_complaint.title,
                    'village_name', v_village_name,
                    'district', v_district,
                    'days_stale', 7
                )
            );
        END IF;

        v_escalated_count := v_escalated_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'escalated_count', v_escalated_count,
        'date', v_today
    );
END;
$$;
ALTER FUNCTION public.svc_escalate_stale_complaints() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.svc_escalate_stale_complaints() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.svc_escalate_stale_complaints() TO service_role;

-- ─── 10. RLS POLICIES FOR NEW TABLES ────────────────────────────────────────

-- 10.1 Notification Tokens RLS
ALTER TABLE public.notification_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_tokens_select" ON public.notification_tokens;
CREATE POLICY "notification_tokens_select" ON public.notification_tokens
FOR SELECT USING (
    user_id = auth.uid()
    OR public.sec_get_role() = 'super_admin'
);

DROP POLICY IF EXISTS "notification_tokens_insert" ON public.notification_tokens;
CREATE POLICY "notification_tokens_insert" ON public.notification_tokens
FOR INSERT WITH CHECK (
    user_id = auth.uid()
);

DROP POLICY IF EXISTS "notification_tokens_update" ON public.notification_tokens;
CREATE POLICY "notification_tokens_update" ON public.notification_tokens
FOR UPDATE USING (
    user_id = auth.uid()
);

DROP POLICY IF EXISTS "notification_tokens_delete" ON public.notification_tokens;
CREATE POLICY "notification_tokens_delete" ON public.notification_tokens
FOR DELETE USING (
    user_id = auth.uid()
    OR public.sec_get_role() = 'super_admin'
);

-- 10.2 Notification Queue RLS (service_role only for writes, super_admin for reads)
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_queue_select" ON public.notification_queue;
CREATE POLICY "notification_queue_select" ON public.notification_queue
FOR SELECT USING (
    public.sec_get_role() = 'super_admin'
    OR recipient_user_id = auth.uid()
);

-- No INSERT/UPDATE/DELETE policies for authenticated — writes go through service_role

-- 10.3 Escalation Logs RLS
ALTER TABLE public.escalation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "escalation_logs_select" ON public.escalation_logs;
CREATE POLICY "escalation_logs_select" ON public.escalation_logs
FOR SELECT USING (
    public.sec_get_role() IN ('super_admin', 'district_admin')
    OR (
        village_id = public.sec_get_village()
        AND public.sec_get_role() IN ('village_admin', 'officer')
    )
);

-- 10.4 Anonymous Users RLS
ALTER TABLE public.anonymous_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anonymous_users_select" ON public.anonymous_users;
CREATE POLICY "anonymous_users_select" ON public.anonymous_users
FOR SELECT USING (
    public.sec_get_role() IN ('super_admin', 'district_admin')
    OR (
        village_id = public.sec_get_village()
        AND public.sec_get_role() IN ('village_admin', 'officer')
    )
);

-- 10.5 Anonymous Complaint Link RLS
ALTER TABLE public.anonymous_complaint_link ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anonymous_complaint_link_select" ON public.anonymous_complaint_link;
CREATE POLICY "anonymous_complaint_link_select" ON public.anonymous_complaint_link
FOR SELECT USING (
    public.sec_get_role() = 'super_admin'
    OR EXISTS (
        SELECT 1 FROM public.complaints c
        WHERE c.id = complaint_id
          AND c.village_id = public.sec_get_village()
          AND public.sec_get_role() IN ('village_admin', 'officer')
    )
);

-- ─── 11. GRANT SERVICE_ROLE ACCESS TO NEW TABLES ────────────────────────────
-- service_role bypasses RLS by default, but explicit grants for clarity

GRANT ALL ON public.notification_tokens TO service_role;
GRANT ALL ON public.notification_queue TO service_role;
GRANT ALL ON public.escalation_logs TO service_role;
GRANT ALL ON public.anonymous_users TO service_role;
GRANT ALL ON public.anonymous_complaint_link TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.anonymous_id_seq TO service_role;
