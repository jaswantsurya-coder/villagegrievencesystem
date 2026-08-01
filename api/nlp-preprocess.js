/**
 * POST /api/nlp-preprocess
 * Vercel Node.js Serverless function for NLP Preprocessing & Duplicate Check.
 * Language Detection, Text Cleaning, Spam Detection, Keyword Extraction, Urgency Scoring.
 */

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  try {
    const { text, village_id } = req.body || {};
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
    console.error('[nlp-preprocess API error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
