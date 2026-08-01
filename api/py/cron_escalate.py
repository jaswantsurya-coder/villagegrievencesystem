"""
GramSeva — 7-Day Complaint Escalation Cron Job
Vercel Cron endpoint that triggers daily escalation check.
Configured in vercel.json to run at 06:00 UTC daily.
"""

import os
import logging
from datetime import datetime, timezone

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse

try:
    from ._lib.supabase_client import get_supabase_admin
    from ._lib.firebase_push import send_push_notification, send_push_to_multiple
    from ._lib.brevo_email import send_email
    from ._lib.notification_templates import get_notification_content
except ImportError:
    from _lib.supabase_client import get_supabase_admin
    from _lib.firebase_push import send_push_notification, send_push_to_multiple
    from _lib.brevo_email import send_email
    from _lib.notification_templates import get_notification_content

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gramseva.cron_escalate")

app = FastAPI(title="GramSeva Escalation Cron", version="1.0.0")

# Vercel Cron sends a secret via CRON_SECRET header
CRON_SECRET = os.environ.get("CRON_SECRET", "")


@app.get("/api/py/cron_escalate")
@app.post("/api/py/cron_escalate")
async def run_escalation(request: Request):
    """
    Daily cron job: Find complaints not updated for 7+ days,
    mark them escalated, and notify village admins + officers.
    
    Security: Validates CRON_SECRET header (set in Vercel dashboard).
    """
    # Verify cron secret (Vercel sends this automatically for cron jobs)
    auth_header = request.headers.get("authorization", "")
    cron_header = request.headers.get("x-vercel-cron-secret", "")

    if CRON_SECRET:
        token = auth_header.replace("Bearer ", "").strip()
        if token != CRON_SECRET and cron_header != CRON_SECRET:
            raise HTTPException(status_code=403, detail="Unauthorized cron request")

    sb = get_supabase_admin()
    today = datetime.now(timezone.utc).date().isoformat()

    logger.info(f"[Escalation Cron] Running for {today}")

    # ─── Step 1: Find stale complaints ────────────────────────────────
    # Complaints with status Open/Assigned/In Progress that haven't been
    # updated in 7+ days and aren't already escalated today
    try:
        stale_result = sb.rpc("svc_escalate_stale_complaints").execute()
        escalation_data = stale_result.data

        if isinstance(escalation_data, str):
            import json
            escalation_data = json.loads(escalation_data)

        escalated_count = escalation_data.get("escalated_count", 0) if isinstance(escalation_data, dict) else 0

        if escalated_count == 0:
            logger.info("[Escalation Cron] No stale complaints found")
            return JSONResponse({
                "success": True,
                "date": today,
                "escalated_count": 0,
                "message": "No complaints needed escalation",
            })

        logger.info(f"[Escalation Cron] Escalated {escalated_count} complaints")

    except Exception as e:
        logger.error(f"[Escalation Cron] RPC failed: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": f"Escalation RPC failed: {str(e)}"},
        )

    # ─── Step 2: Fetch escalated complaints for notifications ─────────
    try:
        escalated_complaints = sb.table("complaints").select(
            "id, ticket_id, title, village_id, status, updated_at, escalation_count"
        ).eq("is_escalated", True).order("village_id").execute()

        complaints_data = escalated_complaints.data or []
    except Exception as e:
        logger.error(f"[Escalation Cron] Failed to fetch escalated complaints: {e}")
        complaints_data = []

    # ─── Step 3: Group by village and send notifications ──────────────
    village_groups: dict[int, list] = {}
    for c in complaints_data:
        vid = c.get("village_id")
        if vid:
            village_groups.setdefault(vid, []).append(c)

    notifications_sent = 0
    notification_errors = 0

    for village_id, complaints in village_groups.items():
        # Get village name
        village_info = sb.table("villages").select(
            "village_name, district"
        ).eq("id", village_id).maybe_single().execute()
        village_name = village_info.data.get("village_name", f"Village #{village_id}") if village_info.data else f"Village #{village_id}"

        # Get village admin(s) and officer(s)
        admin_result = sb.table("profiles").select("id, name").eq(
            "village_id", village_id
        ).in_("role", ["village_admin", "officer"]).execute()

        notify_users = admin_result.data or []

        if not notify_users:
            logger.warning(f"[Escalation Cron] No admins/officers for village {village_id}")
            continue

        # ─── Send summary notification to each admin/officer ──────────
        for user in notify_users:
            user_id = user["id"]

            # Summary notification: "X complaints need attention"
            content = get_notification_content("escalation_reminder", {
                "count": len(complaints),
                "village_name": village_name,
                "village_id": village_id,
            })

            # Push notification
            tokens_result = sb.table("notification_tokens").select(
                "fcm_token"
            ).eq("user_id", user_id).execute()

            for token_row in (tokens_result.data or []):
                try:
                    push_result = send_push_notification(
                        fcm_token=token_row["fcm_token"],
                        title=content["title"],
                        body=content["body"],
                        data={
                            "type": "escalation_reminder",
                            "count": str(len(complaints)),
                            "village_id": str(village_id),
                            "action_url": "/?view=admin",
                            "require_interaction": "true",
                        },
                    )
                    if push_result["success"]:
                        notifications_sent += 1
                    elif push_result.get("invalid_token"):
                        # Clean up invalid token
                        sb.table("notification_tokens").delete().eq(
                            "fcm_token", token_row["fcm_token"]
                        ).execute()
                        logger.info(f"Removed invalid token for user {user_id}")
                except Exception as e:
                    logger.error(f"Push notification failed for {user_id}: {e}")
                    notification_errors += 1

            # Email notification
            try:
                user_auth = sb.auth.admin.get_user_by_id(user_id)
                if user_auth and user_auth.user and user_auth.user.email:
                    email_result = await send_email(
                        to_email=user_auth.user.email,
                        to_name=user.get("name", ""),
                        subject=content["subject"],
                        html_content=content["html"],
                        text_content=content["body"],
                    )
                    if email_result["success"]:
                        notifications_sent += 1
                    else:
                        notification_errors += 1
            except Exception as e:
                logger.error(f"Email notification failed for {user_id}: {e}")
                notification_errors += 1

            # Log to notification_queue
            try:
                sb.table("notification_queue").insert({
                    "notification_type": "escalation_reminder",
                    "channel": "push",
                    "recipient_user_id": user_id,
                    "subject": content["subject"],
                    "body_text": content["body"],
                    "body_html": content.get("html"),
                    "payload": {
                        "count": len(complaints),
                        "village_id": village_id,
                        "complaint_ids": [c["id"] for c in complaints],
                    },
                    "status": "sent",
                    "village_id": village_id,
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                }).execute()
            except Exception as e:
                logger.error(f"Notification queue log failed: {e}")

    logger.info(
        f"[Escalation Cron] Complete: {escalated_count} escalated, "
        f"{notifications_sent} notifications sent, {notification_errors} errors"
    )

    return JSONResponse({
        "success": True,
        "date": today,
        "escalated_count": escalated_count,
        "villages_affected": len(village_groups),
        "notifications_sent": notifications_sent,
        "notification_errors": notification_errors,
    })
