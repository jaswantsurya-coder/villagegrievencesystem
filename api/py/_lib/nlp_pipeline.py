"""
GramSeva — Phase 2: NLP Intelligence Pipeline Engine
Fast, lightweight, CPU-optimized NLP module for:
- Automatic Language Detection (Telugu, Hindi, English, Code-Mixed)
- Text Cleaning & Normalization
- Spam & Fake Complaint Detection
- Keyword Extraction
- Urgency Classification
- Semantic Similarity & Duplicate Detection
"""

import re
import math
import unicodedata
from typing import Dict, List, Any, Tuple

# ─── 1. LANGUAGE DETECTION ───────────────────────────────────────────────────

TELUGU_RANGE = (0x0C00, 0x0C7F)
HINDI_RANGE = (0x0900, 0x097F)

def detect_language(text: str) -> str:
    if not text or not text.strip():
        return "Unknown"

    telugu_count = 0
    hindi_count = 0
    latin_count = 0

    for char in text:
        cp = ord(char)
        if TELUGU_RANGE[0] <= cp <= TELUGU_RANGE[1]:
            telugu_count += 1
        elif HINDI_RANGE[0] <= cp <= HINDI_RANGE[1]:
            hindi_count += 1
        elif char.isalpha() and cp < 128:
            latin_count += 1

    total_chars = telugu_count + hindi_count + latin_count
    if total_chars == 0:
        return "English"

    tel_ratio = telugu_count / total_chars
    hin_ratio = hindi_count / total_chars
    lat_ratio = latin_count / total_chars

    if tel_ratio > 0.3 and lat_ratio > 0.2:
        return "Telugu-English"
    elif hin_ratio > 0.3 and lat_ratio > 0.2:
        return "Hindi-English"
    elif tel_ratio > 0.4:
        return "Telugu"
    elif hin_ratio > 0.4:
        return "Hindi"
    else:
        return "English"

# ─── 2. TEXT CLEANING & NORMALIZATION ────────────────────────────────────────

TYPO_MAP = {
    "pwer": "power", "powar": "power", "powe": "power",
    "watr": "water", "wtr": "water", "watar": "water",
    "drinage": "drainage", "draing": "drainage", "drin": "drainage",
    "rood": "road", "rodd": "road", "roade": "road",
    "strit": "street", "streat": "street", "strt": "street",
    "garbag": "garbage", "gargabe": "garbage",
    "transfomer": "transformer", "transfomer": "transformer",
    "electrik": "electric", "electrcity": "electricity",
}

def clean_and_normalize(text: str) -> str:
    if not text:
        return ""

    # Unicode NFC normalization
    normalized = unicodedata.normalize('NFC', text)

    # Replace multiple whitespaces and newlines with a single space
    cleaned = re.sub(r'\s+', ' ', normalized).strip()

    # Remove excessive repeated punctuation (e.g. "!!!!" -> "!")
    cleaned = re.sub(r'([!?,.-])\1+', r'\1', cleaned)

    # Correct common English typos in village complaints
    words = cleaned.split()
    corrected_words = []
    for word in words:
        w_lower = word.lower()
        if w_lower in TYPO_MAP:
            corrected_words.append(TYPO_MAP[w_lower])
        else:
            corrected_words.append(word)

    return " ".join(corrected_words)

# ─── 3. SPAM & FAKE COMPLAINT DETECTION ──────────────────────────────────────

SPAM_KEYWORDS = {"test", "testing", "asdf", "qwerty", "zxcv", "sample", "demo", "123456", "check123"}
KEYBOARD_MASH_PATTERNS = [r'asdf', r'qwerty', r'zxcv', r'12345', r'(.)\1{4,}']

def calculate_entropy(text: str) -> float:
    if not text:
        return 0.0
    prob = [text.count(c) / len(text) for c in set(text)]
    return -sum(p * math.log2(p) for p in prob)

def detect_spam(text: str) -> Dict[str, Any]:
    score = 0
    reasons = []

    if not text or len(text.strip()) < 8:
        score += 40
        reasons.append("Extremely short text")

    text_lower = text.lower().strip()
    words = text_lower.split()

    # Check spam test keywords
    if any(k in text_lower for k in SPAM_KEYWORDS):
        score += 45
        reasons.append("Contains test/placeholder keywords")

    # Check keyboard mashing
    for pat in KEYBOARD_MASH_PATTERNS:
        if re.search(pat, text_lower):
            score += 35
            reasons.append("Keyboard mash pattern detected")
            break

    # Check repeated words
    if len(words) > 3:
        unique_ratio = len(set(words)) / len(words)
        if unique_ratio < 0.4:
            score += 35
            reasons.append("High word repetition")

    # Character entropy check
    if len(text) > 15:
        entropy = calculate_entropy(text_lower)
        if entropy < 2.2 or entropy > 5.5:
            score += 25
            reasons.append("Abnormal character distribution")

    final_score = min(100, score)
    return {
        "spam_score": final_score,
        "spam_flag": final_score >= 60,
        "reasons": reasons
    }

# ─── 4. KEYWORD EXTRACTION ───────────────────────────────────────────────────

KEYWORD_TAXONOMY = {
    "Water Supply": ["water", "drinking water", "pipe", "pipeline", "tap", "tank", "borewell", "నీరు", "మంచి నీరు", "पानी"],
    "Drainage": ["drainage", "drain", "sewage", "gutter", "overflow", "మరుగుదొడ్డి", "డ్రైనేజీ", "नाली"],
    "Electricity": ["electricity", "power", "current", "wire", "voltage", "light", "కరెంట్", "విద్యుత్", "बिजली"],
    "Street Light": ["street light", "streetlight", "lamp", "light", "వీధి దీపాలు", "स्ट्रीट लाइट"],
    "Garbage": ["garbage", "trash", "waste", "cleanliness", "dustbin", "చెత్త", "कचरा"],
    "Road": ["road", "pothole", "tar", "cement road", "street", "రోడ్డు", "రహదారి", "सड़क"],
    "Hospital": ["hospital", "clinic", "doctor", "health center", "medicine", "ఆసుపత్రి", "अस्पताल"],
    "School": ["school", "teacher", "education", "classroom", "పాఠశాల", "బడి", "स्कूल"],
    "Sanitation": ["sanitation", "hygiene", "mosquito", "fever", "పరిశుభ్రత", "स्वच्छता"],
    "Agriculture": ["agriculture", "crop", "farmer", "fertilizer", "irrigation", "వ్యవసాయం", "రైతు", "किसान"],
    "Pension": ["pension", "widow pension", "old age pension", "పింఛన్", "ఫంక్షన్", "पेंशन"],
    "Government Scheme": ["scheme", "ration", "housing", "house site", "పథకం", "రేషన్", "योजना"],
    "Flood": ["flood", "waterlogging", "heavy rain", "వరదలు", "बाढ़"],
    "Transformer": ["transformer", "dp", "eb box", "ట్రాన్స్‌ఫార్మర్", "ट्रांसफार्मर"],
    "Pipe Leakage": ["leak", "leakage", "burst", "లీకేజీ", "लीकेज"]
}

def extract_keywords(text: str) -> List[str]:
    if not text:
        return []

    text_lower = text.lower()
    found_keywords = set()

    for category, terms in KEYWORD_TAXONOMY.items():
        for term in terms:
            if term in text_lower:
                found_keywords.add(category)
                break

    return sorted(list(found_keywords))

# ─── 5. URGENCY DETECTION ────────────────────────────────────────────────────

CRITICAL_TRIGGERS = [
    "fire", "explosion", "transformer explosion", "electric shock", "shock",
    "live wire", "building collapse", "gas leak", "flood", "accident",
    "medical emergency", "death risk", "ప్రమాదం", "కాలిపోయింది", "షాక్", "आग", "हादसा"
]

HIGH_TRIGGERS = [
    "water leakage", "pipe burst", "road block", "power outage", "blackout",
    "drainage overflow", "contaminated water", "fever outbreak", "dengue",
    "లీకేజీ", "కరెంట్ పోయింది", "नाली ओवरफ्लो"
]

MEDIUM_TRIGGERS = [
    "street light not working", "garbage accumulation", "pothole", "pension delayed",
    "street light", "dustbin", "దీపాలు పనిచేయుటలేదు"
]

def detect_urgency(text: str) -> str:
    if not text:
        return "Low"

    text_lower = text.lower()

    for trig in CRITICAL_TRIGGERS:
        if trig in text_lower:
            return "Critical"

    for trig in HIGH_TRIGGERS:
        if trig in text_lower:
            return "High"

    for trig in MEDIUM_TRIGGERS:
        if trig in text_lower:
            return "Medium"

    return "Low"

# ─── 6. SEMANTIC SIMILARITY & DUPLICATE DETECTION ────────────────────────────

def compute_jaccard_ngram_similarity(text1: str, text2: str, n: int = 2) -> float:
    def get_ngrams(s: str, n: int):
        words = s.lower().split()
        if len(words) < n:
            return set(words)
        return set(zip(*[words[i:] for i in range(n)]))

    ngrams1 = get_ngrams(text1, n)
    ngrams2 = get_ngrams(text2, n)

    if not ngrams1 or not ngrams2:
        return 0.0

    intersection = len(ngrams1.intersection(ngrams2))
    union = len(ngrams1.union(ngrams2))
    return intersection / union if union > 0 else 0.0

def find_similar_complaints(
    new_text: str,
    existing_complaints: List[Dict[str, Any]],
    threshold: float = 0.65
) -> Tuple[List[Dict[str, Any]], float]:
    cleaned_new = clean_and_normalize(new_text)
    matches = []
    max_sim = 0.0

    for item in existing_complaints:
        item_text = item.get("cleaned_complaint") or item.get("description") or item.get("title") or ""
        if not item_text:
            continue

        sim = compute_jaccard_ngram_similarity(cleaned_new, item_text)
        if sim > max_sim:
            max_sim = sim

        if sim >= threshold:
            matches.append({
                "id": item.get("id"),
                "ticket_number": item.get("ticket_number") or item.get("id"),
                "title": item.get("title") or item_text[:50],
                "similarity_score": round(sim, 2),
                "created_at": item.get("created_at")
            })

    matches.sort(key=lambda x: x["similarity_score"], reverse=True)
    return matches, round(max_sim, 2)

# ─── MAIN PREPROCESSING PIPELINE ENTRY POINT ──────────────────────────────────

def run_nlp_pipeline(text: str) -> Dict[str, Any]:
    cleaned = clean_and_normalize(text)
    lang = detect_language(cleaned)
    spam_info = detect_spam(text)
    keywords = extract_keywords(cleaned)
    urgency = detect_urgency(cleaned)

    return {
        "original_text": text,
        "cleaned_complaint": cleaned,
        "detected_language": lang,
        "extracted_keywords": keywords,
        "spam_score": spam_info["spam_score"],
        "spam_flag": spam_info["spam_flag"],
        "spam_reasons": spam_info["reasons"],
        "urgency_score": urgency
    }
