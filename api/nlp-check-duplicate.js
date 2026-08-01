import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/nlp-check-duplicate
 * Semantic duplicate check for pre-submission complaints in the same village.
 */

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  try {
    const { text, village_id, threshold = 0.65 } = req.body || {};
    if (!text || !village_id) {
      return res.status(400).json({ success: false, error: 'text and village_id are required.' });
    }

    const auxUrl = process.env.VITE_SUPABASE_AUX_URL || process.env.SUPABASE_AUX_URL || 'https://dtucrczgagpzjbbrwqit.supabase.co';
    const auxKey = process.env.VITE_SUPABASE_AUX_ANON_KEY || 'sb_publishable_k0ti3YbQtd3y7J2cHF8yMA_HnRa1bhK';

    const supabase = createClient(auxUrl, auxKey);

    const { data: existing, error } = await supabase
      .from('complaints')
      .select('id, ticket_number, title, description, cleaned_complaint, created_at')
      .eq('village_id', village_id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('[nlp-check-duplicate] DB query warning:', error);
    }

    const matches = [];
    let maxSim = 0.0;

    if (existing && existing.length > 0) {
      for (const item of existing) {
        const itemText = item.cleaned_complaint || item.description || item.title || '';
        if (!itemText) continue;

        const sim = calculateJaccard(text, itemText);
        if (sim > maxSim) maxSim = sim;

        if (sim >= threshold) {
          matches.push({
            id: item.id,
            ticket_number: item.ticket_number || item.id,
            title: item.title || itemText.slice(0, 50),
            similarity_score: Number(sim.toFixed(2)),
            created_at: item.created_at
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
      similar_complaints: matches,
      message: has_duplicates
        ? "A similar complaint already exists in your village. Would you like to support the existing complaint or continue submitting a new complaint?"
        : "No duplicate complaints detected."
    });
  } catch (err) {
    console.error('[nlp-check-duplicate error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
