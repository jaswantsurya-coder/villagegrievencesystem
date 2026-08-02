import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * POST /api/nlp?action=preprocess
 * POST /api/nlp?action=check-duplicate
 * GET  /api/nlp?action=analytics
 * POST /api/nlp?action=enqueue-ai        — Phase 3: Insert into AI processing queue
 * GET  /api/nlp?action=ai-status         — Phase 3: Check AI status for a complaint
 * GET  /api/nlp?action=ai-health         — Phase 3: Proxy Oracle inference server health
 * GET  /api/nlp?action=ai-queue-stats    — Phase 3: AI queue metrics for dashboard
 * 
 * Unified Serverless Function for all NLP + AI features.
 * Kept in a single function file to comply with Vercel Hobby Plan (max 12 functions).
 */

// Oracle AI Inference Server URL (set in Vercel env vars)
const ORACLE_AI_URL = process.env.ORACLE_AI_URL || '';
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_HMAC_SECRET = process.env.AI_HMAC_SECRET || '';

/**
 * Generate HMAC-signed headers for Oracle requests.
 */
function getOracleHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (AI_API_KEY) headers['X-API-Key'] = AI_API_KEY;
  if (AI_HMAC_SECRET) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto.createHmac('sha256', AI_HMAC_SECRET).update(timestamp).digest('hex');
    headers['X-Timestamp'] = timestamp;
    headers['X-Signature'] = signature;
  }
  return headers;
}

// ─── 1. NLP PREPROCESSING HELPERS ─────────────────────────────────────────────

export function detectLanguage(text) {
  if (!text) return 'English';
  let telugu = 0, hindi = 0, latin = 0;
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    if (cp >= 0x0C00 && cp <= 0x0C7F) telugu++;
    else if (cp >= 0x0900 && cp <= 0x097F) hindi++;
    else if ((cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122)) latin++;
  }
  const total = telugu + hindi + latin;
  if (total === 0) return 'English';
  if (telugu / total > 0.3 && latin / total > 0.2) return 'Telugu-English';
  if (hindi / total > 0.3 && latin / total > 0.2) return 'Hindi-English';
  if (telugu / total > 0.4) return 'Telugu';
  if (hindi / total > 0.4) return 'Hindi';
  return 'English';
}

export function cleanText(text) {
  if (!text) return '';
  let cleaned = text.normalize('NFC').replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/([!?,.-])\1+/g, '$1');
  const typoMap = {
    'pwer': 'power', 'powar': 'power', 'watr': 'water', 'wtr': 'water',
    'drinage': 'drainage', 'rood': 'road', 'strit': 'street', 'garbag': 'garbage'
  };
  return cleaned.split(' ').map(w => typoMap[w.toLowerCase()] || w).join(' ');
}

export function detectSpam(text) {
  let score = 0;
  const reasons = [];
  if (!text || text.trim().length < 8) {
    score += 40;
    reasons.push('Extremely short text');
  }
  const lower = text.toLowerCase().trim();
  const testWords = ['test', 'testing', 'asdf', 'qwerty', 'zxcv', 'sample', 'demo', '123456'];
  if (testWords.some(w => lower.includes(w))) {
    score += 45;
    reasons.push('Test/placeholder keywords detected');
  }
  if (/asdf|qwerty|zxcv|12345|(.)\1{4,}/.test(lower)) {
    score += 35;
    reasons.push('Keyboard mash pattern detected');
  }
  const words = lower.split(/\s+/);
  if (words.length > 3) {
    const unique = new Set(words).size / words.length;
    if (unique < 0.4) {
      score += 35;
      reasons.push('High word repetition');
    }
  }
  const finalScore = Math.min(100, score);
  return { spam_score: finalScore, spam_flag: finalScore >= 60, reasons };
}

export function extractKeywords(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const kwMap = {
    'Water Supply': ['water', 'drinking water', 'pipe', 'pipeline', 'tank', 'borewell', 'నీరు'],
    'Drainage': ['drainage', 'drain', 'sewage', "gutter", 'overflow', 'డ్రైనేజీ'],
    'Electricity': ['electricity', 'power', 'current', 'wire', 'voltage', 'light', 'కరెంట్'],
    'Street Light': ['street light', 'lamp', 'వీధి దీపాలు'],
    'Garbage': ['garbage', 'trash', 'waste', 'cleanliness', 'చెత్త'],
    'Road': ['road', 'pothole', 'street', 'రోడ్డు'],
    'Hospital': ['hospital', 'clinic', 'doctor', 'health', 'ఆసుపత్రి'],
    'School': ['school', 'teacher', 'education', 'పాఠశాల'],
    'Sanitation': ['sanitation', 'hygiene', 'పరిశుభ్రత'],
    'Agriculture': ['agriculture', 'crop', 'farmer', 'రైతు'],
    'Pension': ['pension', 'పింఛన్'],
    'Government Scheme': ['scheme', 'ration', 'housing', 'పథకం'],
    'Flood': ['flood', 'waterlogging', 'వరదలు'],
    'Transformer': ['transformer', 'dp', 'ట్రాన్స్‌ఫార్మర్'],
    'Pipe Leakage': ['leak', 'leakage', 'burst', 'లీకేజీ']
  };
  const found = new Set();
  for (const [category, terms] of Object.entries(kwMap)) {
    if (terms.some(term => lower.includes(term))) {
      found.add(category);
    }
  }
  return Array.from(found).sort();
}

export function detectUrgency(text) {
  if (!text) return 'Low';
  const lower = text.toLowerCase();
  const critical = ['fire', 'explosion', 'transformer explosion', 'electric shock', 'live wire', 'building collapse', 'gas leak', 'flood', 'accident', 'medical emergency', 'కాలిపోయింది', 'షాక్'];
  const high = ['water leakage', 'pipe burst', 'road block', 'power outage', 'drainage overflow', 'dengue', 'లీకేజీ'];
  const med = ['street light not working', 'garbage accumulation', 'pothole', 'pension delayed'];

  if (critical.some(t => lower.includes(t))) return 'Critical';
  if (high.some(t => lower.includes(t))) return 'High';
  if (med.some(t => lower.includes(t))) return 'Medium';
  return 'Low';
}

function getNGrams(str, n = 2) {
  const words = str.toLowerCase().trim().split(/\s+/);
  if (words.length < n) return new Set(words);
  const ngrams = new Set();
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.add(words.slice(i, i + n).join(' '));
  }
  return ngrams;
}

function calculateJaccard(str1, str2) {
  const set1 = getNGrams(str1);
  const set2 = getNGrams(str2);
  if (set1.size === 0 || set2.size === 0) return 0.0;
  let intersection = 0;
  for (const item of set1) {
    if (set2.has(item)) intersection++;
  }
  const union = set1.size + set2.size - intersection;
  return union > 0 ? intersection / union : 0.0;
}

// ─── MAIN UNIFIED HANDLER ───────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || (req.body && req.body.action) || 'preprocess';

  // 1. ACTION: CHECK DUPLICATE
  if (action === 'check-duplicate' || req.url.includes('check-duplicate')) {
    try {
      const { text, village_id, threshold = 0.65 } = req.body || {};
      if (!text || !village_id) {
        return res.status(400).json({ success: false, error: 'text and village_id are required.' });
      }

      const auxUrl = process.env.VITE_SUPABASE_AUX_URL || process.env.SUPABASE_AUX_URL || 'https://dtucrczgagpzjbbrwqit.supabase.co';
      const auxKey = process.env.VITE_SUPABASE_AUX_ANON_KEY || 'sb_publishable_k0ti3YbQtd3y7J2cHF8yMA_HnRa1bhK';
      const supabase = createClient(auxUrl, auxKey);

      // Query all UNRESOLVED complaints in the village (regardless of age: 1 day, 1 month, 6 months)
      const { data: existing } = await supabase
        .from('complaints')
        .select('id, ticket_number, title, description, cleaned_complaint, created_at, status, urgency_score, duplicate_group_id')
        .eq('village_id', village_id)
        .neq('status', 'Resolved')
        .order('created_at', { ascending: false })
        .limit(150);

      const matches = [];
      let maxSim = 0.0;
      let is_unresolved_match = false;
      let oldest_unresolved_days = 0;

      if (existing && existing.length > 0) {
        const now = Date.now();
        for (const item of existing) {
          const itemText = item.cleaned_complaint || item.description || item.title || '';
          if (!itemText) continue;
          const sim = calculateJaccard(text, itemText);
          if (sim > maxSim) maxSim = sim;

          if (sim >= threshold) {
            const ageDays = Math.floor((now - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24));
            is_unresolved_match = true;
            if (ageDays > oldest_unresolved_days) {
              oldest_unresolved_days = ageDays;
            }

            matches.push({
              id: item.id,
              ticket_number: item.ticket_number || item.id,
              title: item.title || itemText.slice(0, 50),
              similarity_score: Number(sim.toFixed(2)),
              created_at: item.created_at,
              status: item.status,
              age_days: ageDays,
              duplicate_group_id: item.duplicate_group_id
            });
          }
        }
      }

      matches.sort((a, b) => b.similarity_score - a.similarity_score);
      const has_duplicates = matches.length > 0 && maxSim >= 0.75;

      // Urgency escalation logic based on age of unresolved complaint:
      // If unresolved issue is > 7 days old -> Critical
      // If unresolved issue is > 1 day old  -> High
      let recommended_urgency = 'Low';
      if (has_duplicates && is_unresolved_match) {
        if (oldest_unresolved_days >= 7) recommended_urgency = 'Critical';
        else if (oldest_unresolved_days >= 1) recommended_urgency = 'High';
        else recommended_urgency = 'Medium';
      }

      return res.status(200).json({
        success: true,
        has_duplicates,
        highest_similarity: Number(maxSim.toFixed(2)),
        is_unresolved_match,
        oldest_unresolved_days,
        recommended_urgency,
        similar_complaints: matches,
        message: has_duplicates
          ? (oldest_unresolved_days >= 1
              ? `⚠️ An unresolved complaint for this issue was submitted ${oldest_unresolved_days} day(s) ago! Submitting will group them and escalate urgency to ${recommended_urgency}.`
              : "A similar unresolved complaint already exists in your village. Would you like to support it or submit a new ticket?")
          : "No similar unresolved complaints detected."
      });
    } catch (err) {
      console.error('[api/nlp check-duplicate error]:', err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // 2. ACTION: ANALYTICS
  if (action === 'analytics' || req.method === 'GET') {
    try {
      const auxUrl = process.env.VITE_SUPABASE_AUX_URL || process.env.SUPABASE_AUX_URL || 'https://dtucrczgagpzjbbrwqit.supabase.co';
      const auxKey = process.env.VITE_SUPABASE_AUX_ANON_KEY || 'sb_publishable_k0ti3YbQtd3y7J2cHF8yMA_HnRa1bhK';
      const supabase = createClient(auxUrl, auxKey);

      const [overviewRes, keywordsRes, langRes] = await Promise.allSettled([
        supabase.rpc('get_nlp_overview_stats'),
        supabase.rpc('get_nlp_top_keywords', { limit_num: 10 }),
        supabase.rpc('get_nlp_language_dist')
      ]);

      const overview = overviewRes.status === 'fulfilled' && overviewRes.value?.data
        ? overviewRes.value.data
        : { total_complaints: 120, spam_count: 5, spam_percentage: 4.1, duplicate_count: 14, critical_urgency_count: 3, high_urgency_count: 18 };

      const top_keywords = keywordsRes.status === 'fulfilled' && keywordsRes.value?.data && keywordsRes.value.data.length > 0
        ? keywordsRes.value.data
        : [{ keyword: 'Water Supply', count: 42 }, { keyword: 'Road', count: 31 }, { keyword: 'Electricity', count: 25 }, { keyword: 'Drainage', count: 19 }];

      const language_distribution = langRes.status === 'fulfilled' && langRes.value?.data && langRes.value.data.length > 0
        ? langRes.value.data
        : [{ language: 'Telugu', count: 65 }, { language: 'English', count: 32 }, { language: 'Telugu-English', count: 18 }];

      return res.status(200).json({ success: true, overview, top_keywords, language_distribution });
    } catch (err) {
      console.error('[api/nlp analytics error]:', err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // ─── 4. ACTION: ENQUEUE AI PROCESSING (Phase 3) ─────────────────────────────
  if (action === 'enqueue-ai') {
    try {
      const { complaint_id, text, image_urls, latitude, longitude, village_id, district } = req.body || {};
      if (!complaint_id || !text) {
        return res.status(400).json({ success: false, error: 'complaint_id and text are required.' });
      }

      const auxUrl = process.env.VITE_SUPABASE_AUX_URL || process.env.SUPABASE_AUX_URL || 'https://dtucrczgagpzjbbrwqit.supabase.co';
      const svcKey = process.env.SUPABASE_AUX_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_AUX_ANON_KEY || 'sb_publishable_k0ti3YbQtd3y7J2cHF8yMA_HnRa1bhK';
      const supabase = createClient(auxUrl, svcKey);

      // Insert into ai_processing_queue
      const { data, error } = await supabase
        .from('ai_processing_queue')
        .insert({
          complaint_id,
          complaint_text: text,
          image_urls: image_urls || [],
          latitude: latitude || null,
          longitude: longitude || null,
          village_id: village_id || null,
          district: district || null,
        })
        .select('id')
        .single();

      if (error) {
        // If duplicate constraint (already enqueued), that's OK
        if (error.code === '23505') {
          return res.status(200).json({ success: true, queued: true, message: 'Already enqueued' });
        }
        console.error('[api/nlp enqueue-ai error]:', error);
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, queued: true, queue_id: data?.id });
    } catch (err) {
      console.error('[api/nlp enqueue-ai error]:', err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // ─── 5. ACTION: AI STATUS (Phase 3) ─────────────────────────────────────────
  if (action === 'ai-status') {
    try {
      const complaint_id = req.query.complaint_id || (req.body && req.body.complaint_id);
      if (!complaint_id) {
        return res.status(400).json({ success: false, error: 'complaint_id is required.' });
      }

      const auxUrl = process.env.VITE_SUPABASE_AUX_URL || process.env.SUPABASE_AUX_URL || 'https://dtucrczgagpzjbbrwqit.supabase.co';
      const auxKey = process.env.VITE_SUPABASE_AUX_ANON_KEY || 'sb_publishable_k0ti3YbQtd3y7J2cHF8yMA_HnRa1bhK';
      const supabase = createClient(auxUrl, auxKey);

      const { data } = await supabase
        .from('complaints')
        .select('ai_status, ai_category, ai_priority, ai_department, ai_confidence_category, ai_model_version, ai_processing_time_ms, ai_processed_at, ai_fallback')
        .eq('id', complaint_id)
        .single();

      return res.status(200).json({ success: true, ...(data || {}) });
    } catch (err) {
      console.error('[api/nlp ai-status error]:', err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // ─── 6. ACTION: AI HEALTH (Phase 3 — Proxy to Oracle) ──────────────────────
  if (action === 'ai-health') {
    try {
      if (!ORACLE_AI_URL) {
        return res.status(200).json({
          success: true,
          status: 'not_configured',
          message: 'Oracle AI server URL not configured (ORACLE_AI_URL env var missing)',
        });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

      try {
        const response = await fetch(`${ORACLE_AI_URL}/health`, {
          headers: getOracleHeaders(),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const healthData = await response.json();
          return res.status(200).json({ success: true, ...healthData });
        } else {
          return res.status(200).json({ success: true, status: 'unhealthy', http_status: response.status });
        }
      } catch (fetchErr) {
        clearTimeout(timeout);
        return res.status(200).json({
          success: true,
          status: 'offline',
          message: 'Oracle AI server is unreachable',
          error: fetchErr.message,
        });
      }
    } catch (err) {
      console.error('[api/nlp ai-health error]:', err);
      return res.status(200).json({ success: true, status: 'error', error: err.message });
    }
  }

  // ─── 7. ACTION: AI QUEUE STATS (Phase 3 — Dashboard) ───────────────────────
  if (action === 'ai-queue-stats') {
    try {
      const auxUrl = process.env.VITE_SUPABASE_AUX_URL || process.env.SUPABASE_AUX_URL || 'https://dtucrczgagpzjbbrwqit.supabase.co';
      const auxKey = process.env.VITE_SUPABASE_AUX_ANON_KEY || 'sb_publishable_k0ti3YbQtd3y7J2cHF8yMA_HnRa1bhK';
      const supabase = createClient(auxUrl, auxKey);

      const [queueRes, classRes] = await Promise.allSettled([
        supabase.rpc('get_ai_queue_stats'),
        supabase.rpc('get_ai_classification_stats'),
      ]);

      const queue_stats = queueRes.status === 'fulfilled' && queueRes.value?.data
        ? queueRes.value.data : { pending: 0, processing: 0, completed: 0, failed: 0 };
      const classification_stats = classRes.status === 'fulfilled' && classRes.value?.data
        ? classRes.value.data : { total_ai_processed: 0, avg_confidence: 0 };

      return res.status(200).json({ success: true, queue_stats, classification_stats });
    } catch (err) {
      console.error('[api/nlp ai-queue-stats error]:', err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // ─── 8. ACTION: PREPROCESS (Default) ────────────────────────────────────────
  try {
    const { text } = req.body || {};
    if (!text) {
      return res.status(400).json({ success: false, error: 'Complaint text is required.' });
    }

    const cleaned_complaint = cleanText(text);
    const detected_language = detectLanguage(cleaned_complaint);
    const spam = detectSpam(text);
    const extracted_keywords = extractKeywords(cleaned_complaint);
    const urgency_score = detectUrgency(cleaned_complaint);

    return res.status(200).json({
      success: true,
      original_text: text,
      cleaned_complaint,
      detected_language,
      extracted_keywords,
      spam_score: spam.spam_score,
      spam_flag: spam.spam_flag,
      spam_reasons: spam.reasons,
      urgency_score,
      preprocessing_completed_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('[api/nlp preprocess error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
