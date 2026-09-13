"""
GramSeva AI — Queue Worker
Event-driven (Supabase Realtime) + polling fallback background worker.
Processes items from ai_processing_queue asynchronously.
"""

import os
import time
import asyncio
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger("gramseva.queue_worker")


class QueueWorker:
    """
    Background worker that processes AI inference jobs from ai_processing_queue.

    Primary mode: Supabase Realtime WebSocket (instant event on INSERT)
    Fallback mode: Polling every 30s for orphaned/missed items

    Also runs a self-healing scan every 5 minutes:
      - Complaints with ai_status='Pending' but no queue entry → re-enqueue
      - Queue items stuck in 'processing' for >5 min → reset to 'pending'
    """

    POLL_INTERVAL = 30       # Fallback poll every 30 seconds
    HEAL_INTERVAL = 300      # Self-healing scan every 5 minutes
    STUCK_THRESHOLD = 300    # 5 minutes = stuck processing item

    def __init__(self, supabase_client, model_manager, nlp_pipeline_fn, metrics, worker_id: str = "worker-1"):
        self.sb = supabase_client
        self.model_manager = model_manager
        self.nlp_pipeline = nlp_pipeline_fn
        self.metrics = metrics
        self.worker_id = worker_id
        self._running = True
        self._processing = False

    async def run(self):
        """Start all worker loops concurrently."""
        logger.info(f"[QueueWorker:{self.worker_id}] Starting event-driven + polling worker")

        await asyncio.gather(
            self._realtime_listener(),
            self._poll_fallback(),
            self._self_healing_scan(),
        )

    # ─── PRIMARY: Supabase Realtime Event Listener ────────────────────────────

    async def _realtime_listener(self):
        """
        Subscribe to Supabase Realtime for INSERT events on ai_processing_queue.
        When a new item is inserted, immediately claim and process it.
        """
        try:
            # Supabase Python Realtime channel subscription
            channel = self.sb.channel("ai-queue-events")

            def on_insert(payload):
                """Callback when new queue item is inserted."""
                logger.info(f"[Realtime] New queue item detected: {payload}")
                # Schedule processing in the event loop
                asyncio.ensure_future(self._try_process_next())

            channel.on(
                "postgres_changes",
                callback=on_insert,
                event="INSERT",
                schema="public",
                table="ai_processing_queue",
            )

            await channel.subscribe()
            logger.info("[Realtime] Subscribed to ai_processing_queue INSERT events")

            # Keep the subscription alive
            while self._running:
                await asyncio.sleep(60)

        except Exception as e:
            logger.warning(f"[Realtime] Subscription failed (falling back to polling): {e}")
            # If Realtime fails, the polling fallback continues working
            while self._running:
                await asyncio.sleep(60)

    # ─── FALLBACK: Polling Loop ───────────────────────────────────────────────

    async def _poll_fallback(self):
        """
        Safety net: poll for pending items every 30s.
        Catches items missed by Realtime events.
        """
        while self._running:
            await asyncio.sleep(self.POLL_INTERVAL)
            await self._try_process_next()

    # ─── SELF-HEALING SCAN ────────────────────────────────────────────────────

    async def _self_healing_scan(self):
        """
        Every 5 minutes:
        1. Find complaints with ai_status='Pending' but no queue entry → re-enqueue
        2. Find queue items stuck in 'processing' for >5 min → reset
        """
        while self._running:
            await asyncio.sleep(self.HEAL_INTERVAL)
            try:
                # 1. Reset stuck 'processing' items
                stuck_cutoff = (datetime.now(timezone.utc) - timedelta(seconds=self.STUCK_THRESHOLD)).isoformat()
                result = self.sb.from_("ai_processing_queue") \
                    .update({"status": "pending", "started_at": None, "worker_id": None}) \
                    .eq("status", "processing") \
                    .lt("started_at", stuck_cutoff) \
                    .execute()

                if result.data:
                    logger.info(f"[SelfHeal] Reset {len(result.data)} stuck queue items")

                # 2. Find orphaned complaints (ai_status=Pending, no queue entry)
                orphaned = self.sb.from_("complaints") \
                    .select("id, description, title, photo_urls, latitude, longitude, village_id") \
                    .eq("ai_status", "Pending") \
                    .execute()

                if orphaned.data:
                    for complaint in orphaned.data:
                        # Check if queue entry exists
                        existing = self.sb.from_("ai_processing_queue") \
                            .select("id") \
                            .eq("complaint_id", complaint["id"]) \
                            .execute()

                        if not existing.data:
                            # Re-enqueue
                            text = complaint.get("description") or complaint.get("title") or ""
                            if text:
                                self.sb.from_("ai_processing_queue").insert({
                                    "complaint_id": complaint["id"],
                                    "complaint_text": text,
                                    "image_urls": complaint.get("photo_urls", []),
                                    "latitude": complaint.get("latitude"),
                                    "longitude": complaint.get("longitude"),
                                    "village_id": complaint.get("village_id"),
                                }).execute()
                                logger.info(f"[SelfHeal] Re-enqueued orphaned complaint {complaint['id'][:8]}")

            except Exception as e:
                logger.warning(f"[SelfHeal] Error: {e}")

    # ─── CORE: Claim & Process ────────────────────────────────────────────────

    async def _try_process_next(self):
        """Attempt to claim and process the next queue item."""
        if self._processing:
            return  # Already processing an item (single-threaded inference)

        self._processing = True
        try:
            # Atomically claim via RPC
            result = self.sb.rpc("claim_next_queue_item", {"p_worker_id": self.worker_id}).execute()
            item = result.data

            if isinstance(item, str):
                import json
                item = json.loads(item)

            if not item or not item.get("claimed"):
                return  # No pending items

            logger.info(f"[Worker] Claimed queue item {item['id'][:8]} for complaint {item['complaint_id'][:8]}")
            await self._process_item(item)

        except Exception as e:
            logger.error(f"[Worker] Error claiming item: {e}")
        finally:
            self._processing = False

    async def _process_item(self, item: dict):
        """Run NLP preprocessing + fine-tuned model inference on a queue item."""
        t_total_start = time.time()
        queue_id = item["id"]
        complaint_text = item["complaint_text"]

        try:
            # ─── Step 1: NLP Preprocessing ────────────────────────────
            t_nlp_start = time.time()
            nlp_result = self.nlp_pipeline(complaint_text)
            nlp_time_ms = int((time.time() - t_nlp_start) * 1000)
            logger.info(f"[Worker] NLP done in {nlp_time_ms}ms — lang={nlp_result.get('detected_language')}, "
                        f"urgency={nlp_result.get('urgency_score')}")

            # ─── Step 2: Fine-Tuned Model Inference ───────────────────
            t_ai_start = time.time()
            ai_result = self.model_manager.classify(complaint_text)
            ai_time_ms = int((time.time() - t_ai_start) * 1000)
            logger.info(f"[Worker] AI done in {ai_time_ms}ms — category={ai_result.get('category')}, "
                        f"priority={ai_result.get('priority')}")

            total_time_ms = int((time.time() - t_total_start) * 1000)

            # ─── Step 3: Build completion payload ─────────────────────
            completion_payload = {
                # NLP fields
                "detected_language": nlp_result.get("detected_language", "English"),
                "cleaned_complaint": nlp_result.get("cleaned_complaint", complaint_text),
                "extracted_keywords": nlp_result.get("extracted_keywords", []),
                "spam_score": nlp_result.get("spam_score", 0),
                "spam_flag": nlp_result.get("spam_flag", False),
                "urgency_score": nlp_result.get("urgency_score", "Low"),
                # AI fields
                "ai_category": ai_result.get("category", "Other"),
                "ai_priority": ai_result.get("priority", "Medium"),
                "ai_department": ai_result.get("department", "Gram Panchayat"),
                "ai_summary_english": ai_result.get("summary_english", ai_result.get("summary", "")),
                "ai_confidence_category": ai_result.get("confidence", {}).get("category", 0.0),
                "ai_confidence_priority": ai_result.get("confidence", {}).get("priority", 0.0),
                "ai_confidence_department": ai_result.get("confidence", {}).get("department", 0.0),
                "ai_raw_response": {
                    **ai_result,
                    "nlp_result": nlp_result,
                    "processing_time_ms": total_time_ms,
                    "nlp_time_ms": nlp_time_ms,
                    "ai_time_ms": ai_time_ms,
                    "model_version": self.model_manager.MODEL_VERSION,
                    "worker_id": self.worker_id,
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                },
                "ai_model_version": self.model_manager.MODEL_VERSION,
                "ai_processing_time_ms": total_time_ms,
            }

            # ─── Step 4: Complete queue item (updates complaint too) ──
            self.sb.rpc("complete_queue_item", {
                "p_queue_id": queue_id,
                "p_result": completion_payload,
            }).execute()

            # ─── Step 5: Record metrics ───────────────────────────────
            queue_wait_ms = int((time.time() - datetime.fromisoformat(
                item["created_at"].replace("Z", "+00:00")
            ).timestamp()) * 1000) if item.get("created_at") else 0

            self.metrics.record_success(nlp_time_ms, ai_time_ms, queue_wait_ms)

            logger.info(f"[Worker] ✅ Completed {item['complaint_id'][:8]} in {total_time_ms}ms "
                        f"(NLP:{nlp_time_ms}ms + AI:{ai_time_ms}ms)")

        except Exception as e:
            logger.error(f"[Worker] ❌ Failed {item['complaint_id'][:8]}: {e}")
            self.metrics.record_failure()

            # Fail with exponential backoff
            try:
                self.sb.rpc("fail_queue_item", {
                    "p_queue_id": queue_id,
                    "p_error": str(e)[:500],
                }).execute()
            except Exception as fail_err:
                logger.error(f"[Worker] Failed to record failure: {fail_err}")

    def stop(self):
        """Gracefully stop the worker."""
        self._running = False
        logger.info(f"[QueueWorker:{self.worker_id}] Stopping")
