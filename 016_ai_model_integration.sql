-- ============================================================
-- GramSeva — Phase 3: AI Model Integration Database Schema
-- Migration 016: AI classification fields, processing queue,
--   metrics table, Realtime subscription, and RPC functions
-- Target DB: Auxiliary Supabase (dtucrczgagpzjbbrwqit)
-- ============================================================

-- ─── 1. EXTEND COMPLAINTS TABLE WITH AI FIELDS ──────────────────────────────

-- AI Processing Status (Pending → Processing → Completed → Failed)
ALTER TABLE IF EXISTS complaints
  ADD COLUMN IF NOT EXISTS ai_status VARCHAR(20) DEFAULT 'Pending';

-- Fine-tuned model classification results
ALTER TABLE IF EXISTS complaints
  ADD COLUMN IF NOT EXISTS ai_category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ai_priority VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ai_department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ai_summary_english TEXT;

-- Granular confidence scores (per-field)
ALTER TABLE IF EXISTS complaints
  ADD COLUMN IF NOT EXISTS ai_confidence_category FLOAT DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS ai_confidence_priority FLOAT DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS ai_confidence_department FLOAT DEFAULT 0.0;

-- Full raw AI response for auditing, debugging, and retraining
ALTER TABLE IF EXISTS complaints
  ADD COLUMN IF NOT EXISTS ai_raw_response JSONB;

-- Model version tracking (e.g., GramSeva-Qwen2.5-v1)
ALTER TABLE IF EXISTS complaints
  ADD COLUMN IF NOT EXISTS ai_model_version VARCHAR(50);

-- Processing metadata
ALTER TABLE IF EXISTS complaints
  ADD COLUMN IF NOT EXISTS ai_processing_time_ms INT,
  ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_fallback BOOLEAN DEFAULT FALSE;

-- Multimodal metadata (stored now for future use)
ALTER TABLE IF EXISTS complaints
  ADD COLUMN IF NOT EXISTS ai_image_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_location_context JSONB;

-- OCR-ready field (future: extracted text from complaint images)
ALTER TABLE IF EXISTS complaints
  ADD COLUMN IF NOT EXISTS ai_ocr_text TEXT;


-- ─── 2. AI PROCESSING QUEUE TABLE ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'permanently_failed')),
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 4,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  worker_id VARCHAR(50),
  -- Payload: text + multimodal metadata passed to AI
  complaint_text TEXT NOT NULL,
  image_urls JSONB DEFAULT '[]'::jsonb,
  latitude FLOAT,
  longitude FLOAT,
  village_id UUID,
  district VARCHAR(100),
  state VARCHAR(100) DEFAULT 'Andhra Pradesh',
  CONSTRAINT uq_queue_complaint UNIQUE(complaint_id)
);

COMMENT ON TABLE ai_processing_queue IS 'Dedicated queue for async AI processing of complaints. Workers claim items atomically.';


-- ─── 3. AI METRICS TABLE ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  total_requests BIGINT DEFAULT 0,
  successful_requests BIGINT DEFAULT 0,
  failed_requests BIGINT DEFAULT 0,
  avg_queue_wait_ms INT DEFAULT 0,
  avg_nlp_time_ms INT DEFAULT 0,
  avg_ai_time_ms INT DEFAULT 0,
  model_load_time_ms INT DEFAULT 0,
  queue_throughput_per_min FLOAT DEFAULT 0.0,
  model_version VARCHAR(50),
  worker_id VARCHAR(50)
);

COMMENT ON TABLE ai_metrics IS 'Periodic snapshots of AI inference metrics for dashboard analytics.';


-- ─── 4. INDEXES ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_queue_pending
  ON ai_processing_queue(status, next_retry_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_queue_complaint
  ON ai_processing_queue(complaint_id);

CREATE INDEX IF NOT EXISTS idx_complaints_ai_status
  ON complaints(ai_status);

CREATE INDEX IF NOT EXISTS idx_complaints_ai_category
  ON complaints(ai_category)
  WHERE ai_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_metrics_recorded
  ON ai_metrics(recorded_at DESC);


-- ─── 5. ENABLE SUPABASE REALTIME ON QUEUE TABLE ─────────────────────────────
-- This allows the Oracle worker to subscribe via WebSocket
-- and receive INSERT events instantly instead of polling.

ALTER PUBLICATION supabase_realtime ADD TABLE ai_processing_queue;


-- ─── 6. RPC: CLAIM NEXT QUEUE ITEM (ATOMIC) ─────────────────────────────────

CREATE OR REPLACE FUNCTION claim_next_queue_item(p_worker_id VARCHAR DEFAULT 'worker-1')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Atomically claim the next pending item using FOR UPDATE SKIP LOCKED
  -- This prevents race conditions when multiple workers are running.
  SELECT * INTO v_item
  FROM ai_processing_queue
  WHERE status = 'pending'
    AND (next_retry_at IS NULL OR next_retry_at <= NOW())
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_item IS NULL THEN
    RETURN jsonb_build_object('claimed', false);
  END IF;

  -- Mark as processing
  UPDATE ai_processing_queue
  SET status = 'processing',
      started_at = NOW(),
      worker_id = p_worker_id
  WHERE id = v_item.id;

  RETURN jsonb_build_object(
    'claimed', true,
    'id', v_item.id,
    'complaint_id', v_item.complaint_id,
    'complaint_text', v_item.complaint_text,
    'image_urls', v_item.image_urls,
    'latitude', v_item.latitude,
    'longitude', v_item.longitude,
    'village_id', v_item.village_id,
    'district', v_item.district,
    'state', v_item.state,
    'retry_count', v_item.retry_count,
    'created_at', v_item.created_at
  );
END;
$$;


-- ─── 7. RPC: COMPLETE QUEUE ITEM ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION complete_queue_item(
  p_queue_id UUID,
  p_result JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_complaint_id UUID;
BEGIN
  -- Get complaint_id from queue
  SELECT complaint_id INTO v_complaint_id
  FROM ai_processing_queue
  WHERE id = p_queue_id;

  IF v_complaint_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Queue item not found');
  END IF;

  -- Mark queue item completed
  UPDATE ai_processing_queue
  SET status = 'completed',
      processed_at = NOW(),
      last_error = NULL
  WHERE id = p_queue_id;

  -- Update complaint with AI results
  UPDATE complaints
  SET
    ai_status = 'Completed',
    ai_category = COALESCE(p_result->>'ai_category', ai_category),
    ai_priority = COALESCE(p_result->>'ai_priority', ai_priority),
    ai_department = COALESCE(p_result->>'ai_department', ai_department),
    ai_summary_english = COALESCE(p_result->>'ai_summary_english', ai_summary_english),
    ai_confidence_category = COALESCE((p_result->>'ai_confidence_category')::FLOAT, 0.0),
    ai_confidence_priority = COALESCE((p_result->>'ai_confidence_priority')::FLOAT, 0.0),
    ai_confidence_department = COALESCE((p_result->>'ai_confidence_department')::FLOAT, 0.0),
    ai_raw_response = COALESCE(p_result->'ai_raw_response', ai_raw_response),
    ai_model_version = COALESCE(p_result->>'ai_model_version', ai_model_version),
    ai_processing_time_ms = COALESCE((p_result->>'ai_processing_time_ms')::INT, ai_processing_time_ms),
    ai_processed_at = NOW(),
    ai_fallback = FALSE,
    -- Also update NLP fields if provided
    detected_language = COALESCE(p_result->>'detected_language', detected_language),
    cleaned_complaint = COALESCE(p_result->>'cleaned_complaint', cleaned_complaint),
    extracted_keywords = COALESCE(p_result->'extracted_keywords', extracted_keywords),
    spam_score = COALESCE((p_result->>'spam_score')::INT, spam_score),
    spam_flag = COALESCE((p_result->>'spam_flag')::BOOLEAN, spam_flag),
    urgency_score = COALESCE(p_result->>'urgency_score', urgency_score),
    preprocessing_completed_at = NOW(),
    updated_at = NOW()
  WHERE id = v_complaint_id;

  RETURN jsonb_build_object(
    'success', true,
    'complaint_id', v_complaint_id,
    'message', 'AI processing completed and complaint updated'
  );
END;
$$;


-- ─── 8. RPC: FAIL QUEUE ITEM (WITH EXPONENTIAL BACKOFF) ─────────────────────

CREATE OR REPLACE FUNCTION fail_queue_item(
  p_queue_id UUID,
  p_error TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_retry_count INT;
  v_max_retries INT;
  v_complaint_id UUID;
  v_next_retry TIMESTAMPTZ;
  v_delays INT[] := ARRAY[30, 120, 300, 600]; -- 30s, 2m, 5m, 10m
  v_delay INT;
BEGIN
  SELECT retry_count, max_retries, complaint_id
  INTO v_retry_count, v_max_retries, v_complaint_id
  FROM ai_processing_queue
  WHERE id = p_queue_id;

  IF v_complaint_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Queue item not found');
  END IF;

  v_retry_count := v_retry_count + 1;

  IF v_retry_count >= v_max_retries THEN
    -- Permanently failed — all retries exhausted
    UPDATE ai_processing_queue
    SET status = 'permanently_failed',
        retry_count = v_retry_count,
        last_error = p_error,
        processed_at = NOW()
    WHERE id = p_queue_id;

    -- Mark complaint as failed with fallback flag
    UPDATE complaints
    SET ai_status = 'Failed',
        ai_fallback = TRUE,
        updated_at = NOW()
    WHERE id = v_complaint_id;

    RETURN jsonb_build_object(
      'success', true,
      'permanently_failed', true,
      'retry_count', v_retry_count,
      'message', 'All retries exhausted. Complaint marked as AI Failed.'
    );
  ELSE
    -- Schedule retry with exponential backoff
    v_delay := v_delays[LEAST(v_retry_count, array_length(v_delays, 1))];
    v_next_retry := NOW() + (v_delay || ' seconds')::INTERVAL;

    UPDATE ai_processing_queue
    SET status = 'pending',
        retry_count = v_retry_count,
        last_error = p_error,
        next_retry_at = v_next_retry,
        started_at = NULL,
        worker_id = NULL
    WHERE id = p_queue_id;

    RETURN jsonb_build_object(
      'success', true,
      'permanently_failed', false,
      'retry_count', v_retry_count,
      'next_retry_at', v_next_retry,
      'delay_seconds', v_delay
    );
  END IF;
END;
$$;


-- ─── 9. RPC: GET AI QUEUE STATS (FOR DASHBOARD) ─────────────────────────────

CREATE OR REPLACE FUNCTION get_ai_queue_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending BIGINT;
  v_processing BIGINT;
  v_completed BIGINT;
  v_failed BIGINT;
  v_perm_failed BIGINT;
  v_avg_wait_ms FLOAT;
  v_avg_process_ms FLOAT;
BEGIN
  SELECT COUNT(*) INTO v_pending FROM ai_processing_queue WHERE status = 'pending';
  SELECT COUNT(*) INTO v_processing FROM ai_processing_queue WHERE status = 'processing';
  SELECT COUNT(*) INTO v_completed FROM ai_processing_queue WHERE status = 'completed';
  SELECT COUNT(*) INTO v_failed FROM ai_processing_queue WHERE status = 'failed';
  SELECT COUNT(*) INTO v_perm_failed FROM ai_processing_queue WHERE status = 'permanently_failed';

  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (started_at - created_at)) * 1000), 0)
  INTO v_avg_wait_ms
  FROM ai_processing_queue
  WHERE started_at IS NOT NULL;

  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (processed_at - started_at)) * 1000), 0)
  INTO v_avg_process_ms
  FROM ai_processing_queue
  WHERE processed_at IS NOT NULL AND started_at IS NOT NULL;

  RETURN jsonb_build_object(
    'pending', v_pending,
    'processing', v_processing,
    'completed', v_completed,
    'failed', v_failed,
    'permanently_failed', v_perm_failed,
    'total', v_pending + v_processing + v_completed + v_failed + v_perm_failed,
    'avg_queue_wait_ms', ROUND(v_avg_wait_ms::numeric, 0),
    'avg_processing_ms', ROUND(v_avg_process_ms::numeric, 0)
  );
END;
$$;


-- ─── 10. RPC: GET AI CLASSIFICATION STATS (FOR ANALYTICS) ───────────────────

CREATE OR REPLACE FUNCTION get_ai_classification_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_processed BIGINT;
  v_fallback_count BIGINT;
  v_avg_confidence FLOAT;
  v_categories JSONB;
  v_departments JSONB;
  v_agreement_rate FLOAT;
BEGIN
  SELECT COUNT(*) INTO v_total_processed
  FROM complaints WHERE ai_status = 'Completed';

  SELECT COUNT(*) INTO v_fallback_count
  FROM complaints WHERE ai_fallback = TRUE;

  SELECT COALESCE(AVG(ai_confidence_category), 0) INTO v_avg_confidence
  FROM complaints WHERE ai_confidence_category > 0;

  -- Top AI-detected categories
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_categories
  FROM (
    SELECT ai_category AS category, COUNT(*) AS count
    FROM complaints
    WHERE ai_category IS NOT NULL
    GROUP BY ai_category
    ORDER BY count DESC
    LIMIT 10
  ) t;

  -- Top AI-assigned departments
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_departments
  FROM (
    SELECT ai_department AS department, COUNT(*) AS count
    FROM complaints
    WHERE ai_department IS NOT NULL
    GROUP BY ai_department
    ORDER BY count DESC
    LIMIT 10
  ) t;

  -- AI vs Manual category agreement rate
  SELECT COALESCE(
    (COUNT(*) FILTER (WHERE ai_category = category)::FLOAT /
     NULLIF(COUNT(*) FILTER (WHERE ai_category IS NOT NULL AND category IS NOT NULL), 0)) * 100,
    0
  ) INTO v_agreement_rate
  FROM complaints
  WHERE ai_category IS NOT NULL;

  RETURN jsonb_build_object(
    'total_ai_processed', v_total_processed,
    'fallback_count', v_fallback_count,
    'fallback_rate', ROUND((v_fallback_count::numeric / GREATEST(v_total_processed + v_fallback_count, 1)) * 100, 1),
    'avg_confidence', ROUND(v_avg_confidence::numeric * 100, 1),
    'top_categories', v_categories,
    'top_departments', v_departments,
    'ai_manual_agreement_rate', ROUND(v_agreement_rate::numeric, 1)
  );
END;
$$;


-- ─── 11. RPC: RECORD AI METRICS ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION record_ai_metrics(p_metrics JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO ai_metrics (
    total_requests, successful_requests, failed_requests,
    avg_queue_wait_ms, avg_nlp_time_ms, avg_ai_time_ms,
    model_load_time_ms, queue_throughput_per_min,
    model_version, worker_id
  ) VALUES (
    COALESCE((p_metrics->>'total_requests')::BIGINT, 0),
    COALESCE((p_metrics->>'successful_requests')::BIGINT, 0),
    COALESCE((p_metrics->>'failed_requests')::BIGINT, 0),
    COALESCE((p_metrics->>'avg_queue_wait_ms')::INT, 0),
    COALESCE((p_metrics->>'avg_nlp_time_ms')::INT, 0),
    COALESCE((p_metrics->>'avg_ai_time_ms')::INT, 0),
    COALESCE((p_metrics->>'model_load_time_ms')::INT, 0),
    COALESCE((p_metrics->>'queue_throughput_per_min')::FLOAT, 0.0),
    p_metrics->>'model_version',
    p_metrics->>'worker_id'
  );

  RETURN jsonb_build_object('success', true, 'recorded_at', NOW());
END;
$$;


-- ─── 12. PLATFORM SECURITY & SETTINGS TABLE ─────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(100) DEFAULT 'superadmin'
);

-- RLS Security: Allow read to authenticated users, full write to service role / superadmin
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read platform_settings" ON platform_settings;
CREATE POLICY "Allow public read platform_settings"
  ON platform_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow all write platform_settings" ON platform_settings;
CREATE POLICY "Allow all write platform_settings"
  ON platform_settings FOR ALL
  USING (true);

-- Insert default security configuration linked to Supabase dtucrczgagpzjbbrwqit
INSERT INTO platform_settings (key, value, description)
VALUES 
  ('rateLimiting', '{"enabled": true, "max_complaints_per_day": 3, "target_db": "dtucrczgagpzjbbrwqit", "mode": "enforced", "table": "anonymous_complaint_link"}'::jsonb, 'Supabase auxiliary DB rate limits per user/phone number'),
  ('hMacSignature', '{"enabled": true, "algorithm": "sha256", "tolerance_seconds": 300}'::jsonb, 'HMAC SHA256 request signing between Vercel and Oracle Cloud'),
  ('enforceMfa', '{"enabled": true, "provider": "totp"}'::jsonb, 'Multi-factor authentication for SuperAdmin portal'),
  ('auditLogging', '{"enabled": true, "retention_days": 90}'::jsonb, 'Immutable audit trail logging for administrative actions')
ON CONFLICT (key) DO NOTHING;

