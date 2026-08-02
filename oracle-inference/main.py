"""
GramSeva AI — Production Inference Server
FastAPI application for Oracle Cloud ARM CPU deployment.

Features:
  - Automatic HF base model download + LoRA adapter merge
  - Model warm-up (dummy inference at startup)
  - Singleton model manager (thread-safe, CPU-optimized)
  - HMAC request signing + API key authentication
  - /health endpoint with full system metrics
  - /classify single complaint classification
  - /batch-classify batch processing (up to 5)
  - /metrics AI metrics snapshot
  - /model/reload hot-swap LoRA adapter
  - Background queue worker (event-driven + polling)
  - Periodic metrics flush to Supabase
"""

import os
import re
import json
import time
import hmac
import hashlib
import asyncio
import logging
import threading
import psutil
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from dotenv import load_dotenv

load_dotenv()

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("gramseva.ai")

# ─── Imports: Internal Modules ────────────────────────────────────────────────
from metrics_collector import MetricsCollector, MetricsRecorder
from model_updater import ModelUpdater


# ─── NLP Pipeline (copied from api/py/_lib/nlp_pipeline.py for standalone use)
# This allows the Oracle server to run NLP preprocessing without depending on Vercel.

import unicodedata
import math

TELUGU_RANGE = (0x0C00, 0x0C7F)
HINDI_RANGE = (0x0900, 0x097F)

def detect_language(text: str) -> str:
    if not text or not text.strip():
        return "Unknown"
    telugu_count = hindi_count = latin_count = 0
    for char in text:
        cp = ord(char)
        if TELUGU_RANGE[0] <= cp <= TELUGU_RANGE[1]:
            telugu_count += 1
        elif HINDI_RANGE[0] <= cp <= HINDI_RANGE[1]:
            hindi_count += 1
        elif char.isalpha() and cp < 128:
            latin_count += 1
    total = telugu_count + hindi_count + latin_count
    if total == 0:
        return "English"
    tel_r = telugu_count / total
    hin_r = hindi_count / total
    lat_r = latin_count / total
    if tel_r > 0.3 and lat_r > 0.2: return "Telugu-English"
    elif hin_r > 0.3 and lat_r > 0.2: return "Hindi-English"
    elif tel_r > 0.4: return "Telugu"
    elif hin_r > 0.4: return "Hindi"
    return "English"

TYPO_MAP = {
    "pwer": "power", "powar": "power", "powe": "power",
    "watr": "water", "wtr": "water", "watar": "water",
    "drinage": "drainage", "draing": "drainage",
    "rood": "road", "rodd": "road",
    "strit": "street", "streat": "street",
    "garbag": "garbage", "gargabe": "garbage",
    "transfomer": "transformer", "electrik": "electric", "electrcity": "electricity",
}

def clean_and_normalize(text: str) -> str:
    if not text: return ""
    normalized = unicodedata.normalize('NFC', text)
    cleaned = re.sub(r'\s+', ' ', normalized).strip()
    cleaned = re.sub(r'([!?,.-])\1+', r'\1', cleaned)
    words = cleaned.split()
    return " ".join(TYPO_MAP.get(w.lower(), w) for w in words)

SPAM_KEYWORDS = {"test", "testing", "asdf", "qwerty", "zxcv", "sample", "demo", "123456", "check123"}
KEYBOARD_MASH_PATTERNS = [r'asdf', r'qwerty', r'zxcv', r'12345', r'(.)\1{4,}']

def calculate_entropy(text: str) -> float:
    if not text: return 0.0
    prob = [text.count(c) / len(text) for c in set(text)]
    return -sum(p * math.log2(p) for p in prob)

def detect_spam(text: str) -> dict:
    score = 0; reasons = []
    if not text or len(text.strip()) < 8:
        score += 40; reasons.append("Extremely short text")
    text_lower = text.lower().strip()
    words = text_lower.split()
    if any(k in text_lower for k in SPAM_KEYWORDS):
        score += 45; reasons.append("Contains test/placeholder keywords")
    for pat in KEYBOARD_MASH_PATTERNS:
        if re.search(pat, text_lower):
            score += 35; reasons.append("Keyboard mash pattern"); break
    if len(words) > 3:
        if len(set(words)) / len(words) < 0.4:
            score += 35; reasons.append("High word repetition")
    if len(text) > 15:
        entropy = calculate_entropy(text_lower)
        if entropy < 2.2 or entropy > 5.5:
            score += 25; reasons.append("Abnormal character distribution")
    return {"spam_score": min(100, score), "spam_flag": min(100, score) >= 60, "reasons": reasons}

KEYWORD_TAXONOMY = {
    "Water Supply": ["water", "drinking water", "pipe", "pipeline", "tap", "tank", "borewell", "నీరు", "मंచి నీరు", "पानी"],
    "Drainage": ["drainage", "drain", "sewage", "gutter", "overflow", "డ్రైనేజీ", "नाली"],
    "Electricity": ["electricity", "power", "current", "wire", "voltage", "light", "కరెంట్", "విద్యుత్", "बिजली"],
    "Street Light": ["street light", "streetlight", "lamp", "వీధి దీపాలు", "स्ट्रीट लाइट"],
    "Garbage": ["garbage", "trash", "waste", "cleanliness", "dustbin", "చెత్త", "कचरा"],
    "Road": ["road", "pothole", "tar", "cement road", "street", "రోడ్డు", "రహదారి", "सड़क"],
    "Hospital": ["hospital", "clinic", "doctor", "health center", "medicine", "ఆసుపత్రి", "अस्पताल"],
    "School": ["school", "teacher", "education", "classroom", "పాఠశాల", "బడి", "स्कूल"],
    "Sanitation": ["sanitation", "hygiene", "mosquito", "fever", "పరిశుభ్రత", "स्वच्छता"],
    "Agriculture": ["agriculture", "crop", "farmer", "fertilizer", "irrigation", "వ్యవసాయం", "రైతు", "किसान"],
    "Pension": ["pension", "widow pension", "old age pension", "పింఛన్", "पेंशन"],
    "Government Scheme": ["scheme", "ration", "housing", "house site", "పథకం", "రేషన్", "योजना"],
    "Flood": ["flood", "waterlogging", "heavy rain", "వరదలు", "बाढ़"],
    "Transformer": ["transformer", "dp", "eb box", "ట్రాన్స్‌ఫార్మర్", "ट्रांसफार्मर"],
    "Pipe Leakage": ["leak", "leakage", "burst", "లీకేజీ", "लीकेज"],
}

def extract_keywords(text: str) -> list:
    if not text: return []
    text_lower = text.lower()
    return sorted(cat for cat, terms in KEYWORD_TAXONOMY.items() if any(t in text_lower for t in terms))

CRITICAL_TRIGGERS = ["fire", "explosion", "transformer explosion", "electric shock", "shock", "live wire",
                     "building collapse", "gas leak", "flood", "accident", "medical emergency",
                     "ప్రమాదం", "కాలిపోయింది", "షాక్", "आग", "हादसा"]
HIGH_TRIGGERS = ["water leakage", "pipe burst", "road block", "power outage", "blackout",
                 "drainage overflow", "contaminated water", "fever outbreak", "dengue", "లీకేజీ", "కరెంట్ పోయింది"]
MEDIUM_TRIGGERS = ["street light not working", "garbage accumulation", "pothole", "pension delayed",
                   "street light", "dustbin", "దీపాలు పనిచేయుటలేదు"]

def detect_urgency(text: str) -> str:
    if not text: return "Low"
    text_lower = text.lower()
    if any(t in text_lower for t in CRITICAL_TRIGGERS): return "Critical"
    if any(t in text_lower for t in HIGH_TRIGGERS): return "High"
    if any(t in text_lower for t in MEDIUM_TRIGGERS): return "Medium"
    return "Low"

def run_nlp_pipeline(text: str) -> dict:
    cleaned = clean_and_normalize(text)
    return {
        "original_text": text,
        "cleaned_complaint": cleaned,
        "detected_language": detect_language(cleaned),
        "extracted_keywords": extract_keywords(cleaned),
        **detect_spam(text),
        "urgency_score": detect_urgency(cleaned),
    }


# ─── Safety Rules (from gramseva_inference.py) ────────────────────────────────

def apply_safety_rules(complaint_text: str, ai_result: dict) -> dict:
    """Post-process AI output with keyword-based safety overrides."""
    text = complaint_text.lower()

    water_kw = ["నీళ్ళు", "నీళ్లు", "నీరు", "తాగునీరు", "పంపు", "పానీ", "पानी", "जल",
                "drinking water", "no water", "water supply", "tap water"]
    electricity_kw = ["కరెంట్", "విద్యుత్", "లైట్", "बिजली", "लाइट",
                      "electricity", "power", "street light", "current"]
    road_kw = ["road", "రోడ్డు", "రహదారి", "సడ్క", "सड़क", "గుంటలు", "pothole", "potholes"]
    sanitation_kw = ["drainage", "డ్రెయినేజి", "మురుగు", "చెత్త", "नाली", "कचरा",
                     "garbage", "waste", "blocked", "waterlogging", "bad smell", "sewage", "overflow"]
    agriculture_kw = ["బోర్వెల్", "బోర్", "పంట", "వ్యవసాయం", "बोरवेल", "खेती",
                      "borewell", "crop", "agriculture", "farming"]

    if any(k in text for k in sanitation_kw):
        ai_result["category"] = "Sanitation"
        ai_result["department"] = "Gram Panchayat"
    elif any(k in text for k in electricity_kw):
        ai_result["category"] = "Electricity"
        ai_result["department"] = "APSPDCL"
    elif any(k in text for k in road_kw):
        ai_result["category"] = "Roads & Infrastructure"
        ai_result["department"] = "PWD Department"
    elif any(k in text for k in agriculture_kw):
        ai_result["category"] = "Agriculture"
        ai_result["department"] = "Agriculture Department"
    elif any(k in text for k in water_kw):
        ai_result["category"] = "Water Supply"
        ai_result["department"] = "PHED Department"

    # Priority safety overrides
    urgent_kw = ["అత్యవసరం", "urgent", "emergency", "ప్రమాదం", "danger", "खतरा",
                 "వెంటనే", "immediately", "accident", "disease", "dengue", "malaria",
                 "పాడైంది", "damaged", "broken", "blocked", "not working", "not coming"]
    if any(k in text for k in urgent_kw):
        ai_result["priority"] = "High"

    return ai_result


# ═══════════════════════════════════════════════════════════════════════════════
# MODEL MANAGER — Singleton, Thread-Safe, CPU-Optimized
# ═══════════════════════════════════════════════════════════════════════════════

class ModelManager:
    """
    Singleton model manager for Qwen2.5 + LoRA inference.
    - Auto-downloads base model from HuggingFace on first run
    - Loads LoRA adapter and merges
    - Thread-safe inference with torch.inference_mode()
    - CPU-optimized for Oracle ARM (4 OCPUs, 24GB RAM)
    """

    MODEL_VERSION = os.environ.get("MODEL_VERSION", "GramSeva-Qwen2.5-v1")

    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.adapter_path = os.environ.get("ADAPTER_PATH", "./gramseva_model")
        self.base_model_name = None
        self._lock = threading.Lock()
        self._loaded = False

    def load(self):
        """Load base model + LoRA adapter. Auto-downloads from HF if needed."""
        if self._loaded:
            return

        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from peft import PeftModel

        # 1. Read adapter config to get base model name
        config_path = Path(self.adapter_path) / "adapter_config.json"
        if not config_path.exists():
            raise FileNotFoundError(f"adapter_config.json not found at {config_path}")

        with open(config_path) as f:
            adapter_config = json.load(f)

        self.base_model_name = adapter_config.get("base_model_name_or_path", "Qwen/Qwen2.5-1.5B-Instruct")
        logger.info(f"Base model: {self.base_model_name}")
        logger.info(f"LoRA adapter: {self.adapter_path}")

        # 2. Set HuggingFace token if available
        hf_token = os.environ.get("HF_TOKEN")
        token_kwargs = {"token": hf_token} if hf_token else {}

        # 3. CPU optimization
        torch.set_num_threads(4)  # Oracle ARM 4 OCPUs

        # 4. Load tokenizer (auto-download + cache)
        logger.info("Loading tokenizer...")
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.base_model_name,
            trust_remote_code=True,
            **token_kwargs,
        )
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        # 5. Load base model (auto-download + cache via HF_HOME)
        logger.info("Loading base model (CPU, float32 for ARM)...")
        self.model = AutoModelForCausalLM.from_pretrained(
            self.base_model_name,
            torch_dtype=torch.float32,  # ARM doesn't accelerate float16
            device_map="cpu",
            low_cpu_mem_usage=True,
            trust_remote_code=True,
            **token_kwargs,
        )

        # 6. Load and merge LoRA adapter
        logger.info("Loading LoRA adapter...")
        self.model = PeftModel.from_pretrained(self.model, self.adapter_path)
        self.model.eval()

        self._loaded = True
        logger.info(f"✅ Model loaded: {self.base_model_name} + {self.adapter_path}")

    def classify(self, complaint_text: str) -> dict:
        """Run inference on a complaint. Thread-safe."""
        import torch

        if not self._loaded:
            raise RuntimeError("Model not loaded. Call load() first.")

        with self._lock:
            prompt = f"""<|im_start|>system
You are GramSeva AI for Indian village grievance classification.
Return only valid JSON. No explanation.
<|im_end|>
<|im_start|>user
Classify this grievance complaint and extract key information for the GramSeva portal

Complaint: {complaint_text}
<|im_end|>
<|im_start|>assistant
"""
            inputs = self.tokenizer(prompt, return_tensors="pt").to(self.model.device)

            with torch.inference_mode():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=150,
                    do_sample=False,
                    pad_token_id=self.tokenizer.eos_token_id,
                    eos_token_id=self.tokenizer.eos_token_id,
                )

            response = self.tokenizer.decode(
                outputs[0][inputs["input_ids"].shape[1]:],
                skip_special_tokens=True,
            ).strip()

            # Extract JSON from response
            parsed = self._extract_json(response)

            # Add confidence scores (model doesn't output these natively,
            # so we derive from response completeness)
            parsed["confidence"] = {
                "category": 0.85 if parsed.get("category") and parsed["category"] != "Other" else 0.4,
                "priority": 0.80 if parsed.get("priority") else 0.4,
                "department": 0.75 if parsed.get("department") else 0.3,
            }

            return parsed

    def reload_adapter(self, adapter_path: str):
        """Hot-swap LoRA adapter without reloading base model."""
        import torch
        from peft import PeftModel

        with self._lock:
            logger.info(f"Reloading adapter from {adapter_path}...")
            # Remove current adapter
            if hasattr(self.model, 'base_model'):
                base = self.model.base_model.model
            else:
                base = self.model

            self.model = PeftModel.from_pretrained(base, adapter_path)
            self.model.eval()
            self.adapter_path = adapter_path
            logger.info(f"✅ Adapter reloaded: {adapter_path}")

    @staticmethod
    def _extract_json(text: str) -> dict:
        match = re.search(r"\{.*?\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
        return {"raw_response": text, "category": "Other", "priority": "Medium", "department": "Gram Panchayat"}


# ═══════════════════════════════════════════════════════════════════════════════
# GLOBAL INSTANCES
# ═══════════════════════════════════════════════════════════════════════════════

model_manager = ModelManager()

metrics = MetricsCollector(
    model_version=ModelManager.MODEL_VERSION,
    worker_id=os.environ.get("WORKER_ID", "oracle-arm-1"),
)

# ─── Supabase client (lazy init) ─────────────────────────────────────────────
_sb_client = None

def get_supabase():
    global _sb_client
    if _sb_client is None:
        from supabase import create_client
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
        _sb_client = create_client(url, key)
    return _sb_client


# ═══════════════════════════════════════════════════════════════════════════════
# FASTAPI APP WITH LIFESPAN
# ═══════════════════════════════════════════════════════════════════════════════

_startup_time = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: Load model, warm-up, start workers. Shutdown: cleanup."""
    global _startup_time

    logger.info("═══════════════════════════════════════════════")
    logger.info("  GramSeva AI Inference Server — Starting Up")
    logger.info("═══════════════════════════════════════════════")

    # Step 1: Load base model + LoRA adapter (auto-downloads from HF)
    t0 = time.time()
    try:
        model_manager.load()
        load_time_ms = int((time.time() - t0) * 1000)
        metrics.model_load_time_ms = load_time_ms
        logger.info(f"Model loaded in {load_time_ms}ms")
    except Exception as e:
        logger.critical(f"FATAL: Model failed to load: {e}")
        raise

    # Step 2: Warm-up dummy inference (so first real request isn't slow)
    logger.info("Running warm-up inference...")
    t1 = time.time()
    warmup_result = model_manager.classify("Road damaged in village, urgent repair needed")
    warmup_ms = int((time.time() - t1) * 1000)
    logger.info(f"Warm-up done in {warmup_ms}ms — category={warmup_result.get('category')}")

    # Step 3: Start background queue worker
    sb = get_supabase()

    from queue_worker import QueueWorker
    worker = QueueWorker(
        supabase_client=sb,
        model_manager=model_manager,
        nlp_pipeline_fn=run_nlp_pipeline,
        metrics=metrics,
        worker_id=os.environ.get("WORKER_ID", "oracle-arm-1"),
    )
    worker_task = asyncio.create_task(worker.run())

    # Step 4: Start metrics recorder (flush every 5 minutes)
    recorder = MetricsRecorder(metrics, sb, interval_seconds=300)
    recorder_task = asyncio.create_task(recorder.run())

    _startup_time = time.time()
    logger.info("═══════════════════════════════════════════════")
    logger.info("  GramSeva AI Server — READY ✅")
    logger.info("═══════════════════════════════════════════════")

    yield  # App runs here

    # Shutdown
    worker.stop()
    worker_task.cancel()
    recorder_task.cancel()
    logger.info("GramSeva AI Server shut down gracefully")


app = FastAPI(
    title="GramSeva AI Inference Server",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Authentication ──────────────────────────────────────────────────────────

API_KEY = os.environ.get("AI_API_KEY", "")
HMAC_SECRET = os.environ.get("AI_HMAC_SECRET", "")


async def verify_request(request: Request):
    """Verify API key or HMAC signature."""
    api_key = request.headers.get("X-API-Key", "")
    timestamp = request.headers.get("X-Timestamp", "")
    signature = request.headers.get("X-Signature", "")

    # Phase 1: Simple API key check
    if api_key and API_KEY and api_key == API_KEY:
        return True

    # Phase 2: HMAC signature verification
    if signature and timestamp and HMAC_SECRET:
        # Reject requests older than 5 minutes (replay protection)
        try:
            if abs(time.time() - float(timestamp)) > 300:
                raise HTTPException(status_code=401, detail="Request timestamp expired")
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid timestamp")

        expected = hmac.new(
            HMAC_SECRET.encode(),
            timestamp.encode(),
            hashlib.sha256,
        ).hexdigest()

        if hmac.compare_digest(signature, expected):
            return True

        raise HTTPException(status_code=401, detail="Invalid HMAC signature")

    # No auth configured = open (development mode)
    if not API_KEY and not HMAC_SECRET:
        return True

    raise HTTPException(status_code=401, detail="Unauthorized — provide X-API-Key or HMAC signature")


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Full health report with system metrics."""
    process = psutil.Process()
    mem = psutil.virtual_memory()

    # Queue stats from Supabase
    queue_stats = {"pending": 0, "processing": 0}
    try:
        sb = get_supabase()
        result = sb.rpc("get_ai_queue_stats").execute()
        if result.data:
            queue_stats = result.data if isinstance(result.data, dict) else json.loads(result.data)
    except Exception:
        pass

    return {
        "status": "online" if model_manager._loaded else "loading",
        "base_model": model_manager.base_model_name or "not loaded",
        "model_version": model_manager.MODEL_VERSION,
        "adapter_loaded": model_manager._loaded,
        "adapter_path": model_manager.adapter_path,
        "cpu_usage_percent": round(process.cpu_percent(interval=0.1), 1),
        "ram_usage_percent": round(mem.percent, 1),
        "ram_used_gb": round(mem.used / (1024 ** 3), 1),
        "ram_total_gb": round(mem.total / (1024 ** 3), 1),
        "queue_length": queue_stats.get("pending", 0) + queue_stats.get("processing", 0),
        "queue_pending": queue_stats.get("pending", 0),
        "queue_processing": queue_stats.get("processing", 0),
        "queue_completed": queue_stats.get("completed", 0),
        "queue_failed": queue_stats.get("failed", 0) + queue_stats.get("permanently_failed", 0),
        **metrics.snapshot(),
        "uptime_seconds": int(time.time() - _startup_time) if _startup_time else 0,
    }


# ─── Classify Single Complaint ───────────────────────────────────────────────

class ClassifyRequest(BaseModel):
    text: str = Field(..., min_length=5, description="Complaint text to classify")
    include_nlp: bool = Field(default=True, description="Include NLP preprocessing results")

class ClassifyResponse(BaseModel):
    success: bool
    category: str
    priority: str
    department: str
    summary_english: str | None = None
    confidence: dict = {}
    nlp: dict | None = None
    processing_time_ms: int = 0
    model_version: str = ""


@app.post("/classify", response_model=ClassifyResponse)
async def classify(req: ClassifyRequest, _auth=Depends(verify_request)):
    """Classify a single complaint."""
    t0 = time.time()

    # NLP preprocessing
    nlp_result = run_nlp_pipeline(req.text) if req.include_nlp else None

    # AI inference
    ai_result = model_manager.classify(req.text)
    ai_result = apply_safety_rules(req.text, ai_result)

    total_ms = int((time.time() - t0) * 1000)

    return ClassifyResponse(
        success=True,
        category=ai_result.get("category", "Other"),
        priority=ai_result.get("priority", "Medium"),
        department=ai_result.get("department", "Gram Panchayat"),
        summary_english=ai_result.get("summary_english", ai_result.get("summary")),
        confidence=ai_result.get("confidence", {}),
        nlp=nlp_result,
        processing_time_ms=total_ms,
        model_version=model_manager.MODEL_VERSION,
    )


# ─── Batch Classify ──────────────────────────────────────────────────────────

class BatchClassifyRequest(BaseModel):
    complaints: list[ClassifyRequest] = Field(..., max_length=5)


@app.post("/batch-classify")
async def batch_classify(req: BatchClassifyRequest, _auth=Depends(verify_request)):
    """Classify up to 5 complaints in a single request."""
    results = []
    for item in req.complaints:
        t0 = time.time()
        nlp_result = run_nlp_pipeline(item.text)
        ai_result = model_manager.classify(item.text)
        ai_result = apply_safety_rules(item.text, ai_result)
        total_ms = int((time.time() - t0) * 1000)

        results.append({
            "text": item.text[:100],
            "category": ai_result.get("category", "Other"),
            "priority": ai_result.get("priority", "Medium"),
            "department": ai_result.get("department", "Gram Panchayat"),
            "summary_english": ai_result.get("summary_english"),
            "confidence": ai_result.get("confidence", {}),
            "processing_time_ms": total_ms,
        })

    return {"success": True, "results": results, "count": len(results)}


# ─── Metrics ──────────────────────────────────────────────────────────────────

@app.get("/metrics")
async def get_metrics(_auth=Depends(verify_request)):
    """Return AI metrics snapshot."""
    return {"success": True, **metrics.snapshot()}


# ─── Model Reload (Hot-Swap) ─────────────────────────────────────────────────

class ReloadRequest(BaseModel):
    adapter_path: str = Field(..., description="Path to new LoRA adapter directory")
    new_version: str = Field(..., description="New model version string")


@app.post("/model/reload")
async def reload_model(req: ReloadRequest, _auth=Depends(verify_request)):
    """Hot-swap LoRA adapter without restarting the server."""
    updater = ModelUpdater(model_manager)
    result = updater.reload(req.adapter_path, req.new_version)

    if result["success"]:
        metrics.model_version = req.new_version
        return {"success": True, **result}
    else:
        raise HTTPException(status_code=500, detail=result)


# ─── Root ─────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "service": "GramSeva AI Inference Server",
        "version": model_manager.MODEL_VERSION,
        "status": "online" if model_manager._loaded else "loading",
        "endpoints": ["/health", "/classify", "/batch-classify", "/metrics", "/model/reload"],
    }
