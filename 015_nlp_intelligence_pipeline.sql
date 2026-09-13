-- ============================================================
-- GramSeva — Phase 2: NLP Intelligence Pipeline Database Schema
-- Migration 015: Add NLP fields, duplicate tracking, indexes, and RPC analytics functions
-- Target DB: Auxiliary Supabase (dtucrczgagpzjbbrwqit) & Primary Supabase
-- ============================================================

-- 1. Extend complaints table with NLP metadata columns
ALTER TABLE IF EXISTS complaints
  ADD COLUMN IF NOT EXISTS detected_language VARCHAR(50) DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS cleaned_complaint TEXT,
  ADD COLUMN IF NOT EXISTS extracted_keywords JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS spam_score INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spam_flag BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS urgency_score VARCHAR(20) DEFAULT 'Low',
  ADD COLUMN IF NOT EXISTS duplicate_group_id UUID NULL,
  ADD COLUMN IF NOT EXISTS duplicate_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS similarity_score FLOAT DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS preprocessing_completed_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Indexes for high-performance searching & filtering
CREATE INDEX IF NOT EXISTS idx_complaints_village_created ON complaints(village_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_spam_flag ON complaints(spam_flag);
CREATE INDEX IF NOT EXISTS idx_complaints_urgency ON complaints(urgency_score);
CREATE INDEX IF NOT EXISTS idx_complaints_keywords ON complaints USING GIN (extracted_keywords);
CREATE INDEX IF NOT EXISTS idx_complaints_dup_group ON complaints(duplicate_group_id) WHERE duplicate_group_id IS NOT NULL;

-- 3. Stored RPC Function: Get Top Keywords for Analytics
CREATE OR REPLACE FUNCTION get_nlp_top_keywords(limit_num INT DEFAULT 10)
RETURNS TABLE (keyword TEXT, count BIGINT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    kw.value::text AS keyword,
    COUNT(*) AS count
  FROM complaints c,
  LATERAL jsonb_array_elements_text(COALESCE(c.extracted_keywords, '[]'::jsonb)) AS kw
  WHERE c.extracted_keywords IS NOT NULL
  GROUP BY kw.value
  ORDER BY count DESC
  LIMIT limit_num;
$$;

-- 4. Stored RPC Function: Language Distribution
CREATE OR REPLACE FUNCTION get_nlp_language_dist()
RETURNS TABLE (language TEXT, count BIGINT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    COALESCE(detected_language, 'Unknown') AS language,
    COUNT(*) AS count
  FROM complaints
  GROUP BY detected_language
  ORDER BY count DESC;
$$;

-- 5. Stored RPC Function: Spam & Duplicate Statistics
CREATE OR REPLACE FUNCTION get_nlp_overview_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total BIGINT;
  v_spam BIGINT;
  v_duplicates BIGINT;
  v_critical BIGINT;
  v_high BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM complaints;
  SELECT COUNT(*) INTO v_spam FROM complaints WHERE spam_flag = TRUE OR spam_score > 60;
  SELECT COUNT(*) INTO v_duplicates FROM complaints WHERE duplicate_group_id IS NOT NULL OR duplicate_count > 0;
  SELECT COUNT(*) INTO v_critical FROM complaints WHERE urgency_score = 'Critical';
  SELECT COUNT(*) INTO v_high FROM complaints WHERE urgency_score = 'High';

  RETURN jsonb_build_object(
    'total_complaints', v_total,
    'spam_count', v_spam,
    'spam_percentage', ROUND((v_spam::numeric / GREATEST(v_total, 1)) * 100, 1),
    'duplicate_count', v_duplicates,
    'critical_urgency_count', v_critical,
    'high_urgency_count', v_high
  );
END;
$$;

-- 6. Stored RPC Function: Update Status for Entire Complaint Unit (Group)
CREATE OR REPLACE FUNCTION svc_update_complaint_unit_status(
  p_complaint_id UUID,
  p_new_status VARCHAR,
  p_resolution_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_id UUID;
  v_updated_count INT;
BEGIN
  -- Get duplicate_group_id if exists
  SELECT duplicate_group_id INTO v_group_id
  FROM complaints
  WHERE id = p_complaint_id;

  IF v_group_id IS NOT NULL THEN
    -- Update ALL complaints belonging to this grouped unit at once
    UPDATE complaints
    SET 
      status = p_new_status,
      updated_at = NOW()
    WHERE duplicate_group_id = v_group_id OR id = p_complaint_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  ELSE
    -- Single complaint update
    UPDATE complaints
    SET 
      status = p_new_status,
      updated_at = NOW()
    WHERE id = p_complaint_id;

    v_updated_count := 1;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_status', p_new_status,
    'group_id', v_group_id,
    'updated_count', v_updated_count,
    'message', 'Status updated for all complaints in this unit'
  );
END;
$$;
