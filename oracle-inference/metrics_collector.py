"""
GramSeva AI — Metrics Collector
Thread-safe metrics collection for AI inference pipeline.
Periodically flushes aggregated metrics to Supabase ai_metrics table.
"""

import time
import threading
import asyncio
import logging
from collections import deque
from datetime import datetime, timezone

logger = logging.getLogger("gramseva.metrics")


class MetricsCollector:
    """Thread-safe metrics collection for AI dashboard."""

    def __init__(self, model_version: str = "", worker_id: str = "worker-1"):
        self.model_version = model_version
        self.worker_id = worker_id

        # Counters
        self.total_requests = 0
        self.successful_requests = 0
        self.failed_requests = 0

        # Rolling windows (last 100 samples for averages)
        self.nlp_times: deque = deque(maxlen=100)
        self.ai_times: deque = deque(maxlen=100)
        self.queue_waits: deque = deque(maxlen=100)

        # Throughput tracking
        self._minute_timestamps: deque = deque(maxlen=500)

        # Model load time (set once at startup)
        self.model_load_time_ms: int = 0

        # Last successful inference timestamp
        self.last_success_at: str | None = None

        # Thread safety
        self._lock = threading.Lock()

    def record_success(self, nlp_time_ms: int, ai_time_ms: int, queue_wait_ms: int):
        """Record a successful inference."""
        with self._lock:
            self.total_requests += 1
            self.successful_requests += 1
            self.nlp_times.append(nlp_time_ms)
            self.ai_times.append(ai_time_ms)
            self.queue_waits.append(queue_wait_ms)
            self._minute_timestamps.append(time.time())
            self.last_success_at = datetime.now(timezone.utc).isoformat()

    def record_failure(self):
        """Record a failed inference."""
        with self._lock:
            self.total_requests += 1
            self.failed_requests += 1

    @property
    def avg_nlp_time_ms(self) -> int:
        with self._lock:
            return int(sum(self.nlp_times) / max(len(self.nlp_times), 1))

    @property
    def avg_ai_time_ms(self) -> int:
        with self._lock:
            return int(sum(self.ai_times) / max(len(self.ai_times), 1))

    @property
    def avg_queue_wait_ms(self) -> int:
        with self._lock:
            return int(sum(self.queue_waits) / max(len(self.queue_waits), 1))

    @property
    def queue_throughput_per_min(self) -> float:
        """Complaints processed per minute (rolling 5-minute window)."""
        with self._lock:
            if not self._minute_timestamps:
                return 0.0
            cutoff = time.time() - 300  # Last 5 minutes
            recent = [t for t in self._minute_timestamps if t > cutoff]
            if len(recent) < 2:
                return 0.0
            span_minutes = (recent[-1] - recent[0]) / 60.0
            return round(len(recent) / max(span_minutes, 0.1), 1)

    def snapshot(self) -> dict:
        """Return full metrics snapshot for /health and /metrics endpoints."""
        with self._lock:
            return {
                "total_requests": self.total_requests,
                "successful_requests": self.successful_requests,
                "failed_requests": self.failed_requests,
                "avg_queue_wait_ms": self.avg_queue_wait_ms,
                "avg_nlp_time_ms": self.avg_nlp_time_ms,
                "avg_ai_time_ms": self.avg_ai_time_ms,
                "model_load_time_ms": self.model_load_time_ms,
                "queue_throughput_per_min": self.queue_throughput_per_min,
                "last_success_at": self.last_success_at,
                "model_version": self.model_version,
                "worker_id": self.worker_id,
            }

    def db_payload(self) -> dict:
        """Return payload for Supabase record_ai_metrics RPC."""
        snap = self.snapshot()
        return {
            "total_requests": snap["total_requests"],
            "successful_requests": snap["successful_requests"],
            "failed_requests": snap["failed_requests"],
            "avg_queue_wait_ms": snap["avg_queue_wait_ms"],
            "avg_nlp_time_ms": snap["avg_nlp_time_ms"],
            "avg_ai_time_ms": snap["avg_ai_time_ms"],
            "model_load_time_ms": snap["model_load_time_ms"],
            "queue_throughput_per_min": snap["queue_throughput_per_min"],
            "model_version": snap["model_version"],
            "worker_id": snap["worker_id"],
        }


class MetricsRecorder:
    """Periodically flushes metrics to Supabase ai_metrics table."""

    def __init__(self, metrics: MetricsCollector, supabase_client, interval_seconds: int = 300):
        self.metrics = metrics
        self.sb = supabase_client
        self.interval = interval_seconds

    async def run(self):
        """Flush metrics every `interval` seconds."""
        while True:
            await asyncio.sleep(self.interval)
            try:
                payload = self.metrics.db_payload()
                self.sb.rpc("record_ai_metrics", {"p_metrics": payload}).execute()
                logger.info(f"[Metrics] Flushed to DB: {payload['total_requests']} total, "
                            f"{payload['successful_requests']} ok, {payload['failed_requests']} fail")
            except Exception as e:
                logger.warning(f"[Metrics] Failed to flush: {e}")
