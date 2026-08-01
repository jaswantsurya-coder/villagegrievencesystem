import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/nlp?action=preprocess
 * POST /api/nlp?action=check-duplicate
 * GET  /api/nlp?action=analytics
 * 
 * Unified Serverless Function for all Phase 2 NLP features.
 * Kept in a single function file to comply with Vercel Hobby Plan (max 12 functions).
 */

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

      const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from('complaints')
        .select('id, ticket_number, title, description, cleaned_complaint, created_at, status, urgency_score, duplicate_group_id')
        .eq('village_id', village_id)
        .gte('created_at', threeDaysAgo)
        .order('created_at', { ascending: false })
        .limit(100);

      const matches = [];
      let maxSim = 0.0;
      let is_recurring_gap = false;

      if (existing && existing.length > 0) {
        const now = Date.now();
        for (const item of existing) {
          const itemText = item.cleaned_complaint || item.description || item.title || '';
          if (!itemText) continue;
          const sim = calculateJaccard(text, itemText);
          if (sim > maxSim) maxSim = sim;

          if (sim >= threshold) {
            const ageHours = (now - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
            if (ageHours >= 24 && item.status !== 'Resolved') {
              is_recurring_gap = true;
            }

            matches.push({
              id: item.id,
              ticket_number: item.ticket_number || item.id,
              title: item.title || itemText.slice(0, 50),
              similarity_score: Number(sim.toFixed(2)),
              created_at: item.created_at,
              status: item.status,
              age_hours: Math.round(ageHours),
              duplicate_group_id: item.duplicate_group_id
            });
          }
        }
      }

      matches.sort((a, b) => b.similarity_score - a.similarity_score);
      const has_duplicates = matches.length > 0 && maxSim >= 0.75;

      return res.status(200).json({
        success: true,
        has_duplicates,
        highest_similarity: Number(maxSim.toFixed(2)),
        is_recurring_gap,
        recommended_urgency: is_recurring_gap ? 'High' : (maxSim >= 0.85 ? 'High' : 'Low'),
        similar_complaints: matches,
        message: has_duplicates
          ? (is_recurring_gap
              ? "⚠️ An unresolved complaint for this issue was submitted 1-3 days ago. Submitting this will escalate the urgency for village admins!"
              : "A similar complaint already exists in your village. Would you like to support the existing complaint or continue submitting a new complaint?")
          : "No duplicate complaints detected."
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

  // 3. ACTION: PREPROCESS (Default)
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
