"""
GramSeva — Unified Notification Service (FastAPI)
Centralized API for sending push + email notifications.
Deployed as a Vercel Python Serverless Function.

Routes:
  POST /api/py/notification_service — Send notification
  POST /api/py/notification_service/send-to-user — Send to individual user
  POST /api/py/notification_service/send-to-role — Send to all users of a role in a village
  POST /api/py/notification_service/send-to-village — Send to all village members
  POST /api/py/notification_service/send-to-multiple — Send to selected users
  POST /api/py/notification_service/escalate — Run 7-day escalation check
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

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

# ─── Logging Setup ────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gramseva.notification_service")

# ─── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="GramSeva Notification Service",
    version="2.0.0",
    docs_url="/api/py/notification_service/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Auth Guard ───────────────────────────────────────────────────────────────
API_SECRET = os.environ.get("NOTIFICATION_API_SECRET") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def verify_api_key(authorization: Optional[str] = None):
    """Verify the API secret key from Authorization header."""
    if not API_SECRET:
        raise HTTPException(500, "NOTIFICATION_API_SECRET not configured")
    if not authorization:
        raise HTTPException(401, "Missing Authorization header")
    token = authorization.replace("Bearer ", "").strip()
    if token != API_SECRET:
        raise HTTPException(403, "Invalid API key")


# ─── Request Models ──────────────────────────────────────────────────────────

class SendToUserRequest(BaseModel):
    user_id: str
    notification_type: str
    data: dict = Field(default_factory=dict)
    channels: list[str] = Field(default=["push", "email"])


class SendToRoleRequest(BaseModel):
    village_id: int
    role: str  # village_admin, officer, citizen
    notification_type: str
    data: dict = Field(default_factory=dict)
    channels: list[str] = Field(default=["push", "email"])


class SendToVillageRequest(BaseModel):
    village_id: int
    notification_type: str
    data: dict = Field(default_factory=dict)
    channels: list[str] = Field(default=["push", "email"])


class SendToMultipleRequest(BaseModel):
    user_ids: list[str]
    notification_type: str
    data: dict = Field(default_factory=dict)
    channels: list[str] = Field(default=["push", "email"])


class EscalateRequest(BaseModel):
    dry_run: bool = False


# ─── Helper Functions ─────────────────────────────────────────────────────────

def _get_fcm_tokens(user_ids: list[str]) -> list[dict]:
    """Fetch FCM tokens for given user IDs from Supabase."""
    sb = get_supabase_admin()
    result = sb.table("notification_tokens").select(
        "user_id, fcm_token, role, village_id"
    ).in_("user_id", user_ids).execute()
    return result.data or []


def _get_user_email(user_id: str) -> dict | None:
    """Fetch user email from Supabase Auth admin API."""
    sb = get_supabase_admin()
    try:
        user_response = sb.auth.admin.get_user_by_id(user_id)
        if user_response and user_response.user:
            return {
                "email": user_response.user.email,
                "name": getattr(user_response.user, "user_metadata", {}).get("name", ""),
            }
    except Exception as e:
        logger.warning(f"Could not fetch email for {user_id}: {e}")
    return None


def _get_user_profile(user_id: str) -> dict | None:
    """Fetch user profile from profiles table."""
    sb = get_supabase_admin()
    result = sb.table("profiles").select(
        "id, name, phone, role, village_id"
    ).eq("id", user_id).maybe_single().execute()
    return result.data


def _cleanup_invalid_tokens(invalid_tokens: list[str]):
    """Remove invalid/expired FCM tokens from the database."""
    if not invalid_tokens:
        return
    sb = get_supabase_admin()
    for token in invalid_tokens:
        try:
            sb.table("notification_tokens").delete().eq("fcm_token", token).execute()
            logger.info(f"Removed invalid FCM token: ...{token[-8:]}")
        except Exception as e:
            logger.error(f"Failed to remove invalid token: {e}")


def _log_to_queue(
    notification_type: str,
    channel: str,
    recipient_user_id: str,
    recipient_identifier: str,
    subject: str,
    body_text: str,
    body_html: str | None,
    payload: dict,
    status: str,
    external_id: str | None,
    error_message: str | None,
    village_id: int | None,
):
    """Log notification to the notification_queue table."""
    sb = get_supabase_admin()
    try:
        sb.table("notification_queue").insert({
            "notification_type": notification_type,
            "channel": channel,
            "recipient_user_id": recipient_user_id,
            "recipient_identifier": recipient_identifier,
            "subject": subject,
            "body_text": body_text,
            "body_html": body_html,
            "payload": payload,
            "status": status,
            "external_id": external_id,
            "error_message": error_message,
            "village_id": village_id,
            "sent_at": datetime.now(timezone.utc).isoformat() if status == "sent" else None,
        }).execute()
    except Exception as e:
        logger.error(f"Failed to log notification to queue: {e}")


async def _send_notification_to_user(
    user_id: str,
    notification_type: str,
    data: dict,
    channels: list[str],
) -> dict:
    """Core notification delivery for a single user across all channels."""
    content = get_notification_content(notification_type, data)
    results = {"push": None, "email": None}

    # ─── Push Notification ────────────────────────────────────────────
    if "push" in channels:
        tokens = _get_fcm_tokens([user_id])
        if tokens:
            for token_record in tokens:
                push_data = {
                    "type": notification_type,
                    "complaint_id": str(data.get("complaint_id", "")),
                    "ticket_id": str(data.get("ticket_id", "")),
                    "action_url": content.get("action_url", "/"),
                    "notification_id": str(data.get("notification_id", "")),
                    "require_interaction": str(content.get("require_interaction", False)).lower(),
                }
                push_result = send_push_notification(
                    fcm_token=token_record["fcm_token"],
                    title=content["title"],
                    body=content["body"],
                    data=push_data,
                )
                results["push"] = push_result

                # Log to queue
                _log_to_queue(
                    notification_type=notification_type,
                    channel="push",
                    recipient_user_id=user_id,
                    recipient_identifier=token_record["fcm_token"][-20:],
                    subject=content["subject"],
                    body_text=content["body"],
                    body_html=None,
                    payload=data,
                    status="sent" if push_result["success"] else "failed",
                    external_id=push_result.get("message_id"),
                    error_message=push_result.get("error"),
                    village_id=token_record.get("village_id"),
                )

                # Cleanup invalid tokens
                if push_result.get("invalid_token"):
                    _cleanup_invalid_tokens([token_record["fcm_token"]])
        else:
            logger.info(f"No FCM tokens for user {user_id}")

    # ─── Email Notification ───────────────────────────────────────────
    if "email" in channels:
        user_info = _get_user_email(user_id)
        if user_info and user_info.get("email"):
            email_result = await send_email(
                to_email=user_info["email"],
                to_name=user_info.get("name", ""),
                subject=content["subject"],
                html_content=content["html"],
                text_content=content["body"],
            )
            results["email"] = email_result

            profile = _get_user_profile(user_id)
            _log_to_queue(
                notification_type=notification_type,
                channel="email",
                recipient_user_id=user_id,
                recipient_identifier=user_info["email"],
                subject=content["subject"],
                body_text=content["body"],
                body_html=content["html"],
                payload=data,
                status="sent" if email_result["success"] else "failed",
                external_id=email_result.get("message_id"),
                error_message=email_result.get("error"),
                village_id=profile.get("village_id") if profile else None,
            )
        else:
            logger.info(f"No email address for user {user_id}")

    return results


# ─── API Endpoints ────────────────────────────────────────────────────────────

@app.post("/api/py/notification_service/send-to-user")
async def send_to_user(req: SendToUserRequest, authorization: str = Header(None)):
    """Send notification to a specific user."""
    verify_api_key(authorization)

    results = await _send_notification_to_user(
        user_id=req.user_id,
        notification_type=req.notification_type,
        data=req.data,
        channels=req.channels,
    )

    return {
        "success": True,
        "user_id": req.user_id,
        "notification_type": req.notification_type,
        "results": results,
    }


@app.post("/api/py/notification_service/send-to-role")
async def send_to_role(req: SendToRoleRequest, authorization: str = Header(None)):
    """Send notification to all users with a specific role in a village."""
    verify_api_key(authorization)

    sb = get_supabase_admin()
    query = sb.table("profiles").select("id").eq("village_id", req.village_id).eq("role", req.role)
    result = query.execute()
    user_ids = [r["id"] for r in (result.data or [])]

    if not user_ids:
        return {"success": True, "message": f"No users with role '{req.role}' in village {req.village_id}", "sent_count": 0}

    all_results = []
    for uid in user_ids:
        r = await _send_notification_to_user(uid, req.notification_type, req.data, req.channels)
        all_results.append({"user_id": uid, "results": r})

    return {
        "success": True,
        "village_id": req.village_id,
        "role": req.role,
        "notification_type": req.notification_type,
        "sent_count": len(user_ids),
        "results": all_results,
    }


@app.post("/api/py/notification_service/send-to-village")
async def send_to_village(req: SendToVillageRequest, authorization: str = Header(None)):
    """Send notification to all members of a village."""
    verify_api_key(authorization)

    sb = get_supabase_admin()
    result = sb.table("notification_tokens").select(
        "user_id, fcm_token, role"
    ).eq("village_id", req.village_id).execute()

    token_records = result.data or []
    if not token_records:
        return {"success": True, "message": "No notification tokens found for this village", "sent_count": 0}

    content = get_notification_content(req.notification_type, req.data)
    fcm_tokens = [r["fcm_token"] for r in token_records]
    unique_user_ids = list(set(r["user_id"] for r in token_records))

    # Push to all tokens
    push_data = {
        "type": req.notification_type,
        "complaint_id": str(req.data.get("complaint_id", "")),
        "ticket_id": str(req.data.get("ticket_id", "")),
        "action_url": content.get("action_url", "/"),
    }

    push_result = send_push_to_multiple(fcm_tokens, content["title"], content["body"], push_data)

    # Cleanup invalid tokens
    if push_result.get("invalid_tokens"):
        _cleanup_invalid_tokens(push_result["invalid_tokens"])

    # Send emails to unique users
    email_count = 0
    if "email" in req.channels:
        for uid in unique_user_ids:
            user_info = _get_user_email(uid)
            if user_info and user_info.get("email"):
                await send_email(
                    to_email=user_info["email"],
                    to_name=user_info.get("name", ""),
                    subject=content["subject"],
                    html_content=content["html"],
                    text_content=content["body"],
                )
                email_count += 1

    return {
        "success": True,
        "village_id": req.village_id,
        "push_sent": push_result.get("success_count", 0),
        "push_failed": push_result.get("failure_count", 0),
        "emails_sent": email_count,
    }


@app.post("/api/py/notification_service/send-to-multiple")
async def send_to_multiple(req: SendToMultipleRequest, authorization: str = Header(None)):
    """Send notification to multiple selected users."""
    verify_api_key(authorization)

    all_results = []
    for uid in req.user_ids:
        r = await _send_notification_to_user(uid, req.notification_type, req.data, req.channels)
        all_results.append({"user_id": uid, "results": r})

    return {
        "success": True,
        "notification_type": req.notification_type,
        "sent_count": len(req.user_ids),
        "results": all_results,
    }


@app.post("/api/py/notification_service/escalate")
async def run_escalation(req: EscalateRequest, authorization: str = Header(None)):
    """
    Run the 7-day complaint escalation check.
    Finds stale complaints, marks them escalated, notifies admins + officers.
    """
    verify_api_key(authorization)

    sb = get_supabase_admin()

    # Call the Postgres escalation function
    rpc_result = sb.rpc("svc_escalate_stale_complaints").execute()
    escalation_data = rpc_result.data

    if not escalation_data:
        return {"success": True, "escalated_count": 0, "message": "No stale complaints found"}

    escalated_count = escalation_data.get("escalated_count", 0) if isinstance(escalation_data, dict) else 0

    if escalated_count == 0:
        return {"success": True, "escalated_count": 0, "message": "No stale complaints found"}

    if req.dry_run:
        return {"success": True, "dry_run": True, "escalated_count": escalated_count}

    # Fetch escalated complaints details for notifications
    stale_complaints = sb.table("complaints").select(
        "id, ticket_id, title, village_id, status, updated_at, is_escalated, escalation_count"
    ).eq("is_escalated", True).execute()

    # Group by village and notify village admins + officers
    village_complaints: dict[int, list] = {}
    for complaint in (stale_complaints.data or []):
        vid = complaint.get("village_id")
        if vid:
            village_complaints.setdefault(vid, []).append(complaint)

    notification_count = 0
    for village_id, complaints in village_complaints.items():
        # Get village admin
        admin_result = sb.table("profiles").select("id").eq(
            "village_id", village_id
        ).eq("role", "village_admin").execute()

        # Get officers
        officer_result = sb.table("profiles").select("id").eq(
            "village_id", village_id
        ).eq("role", "officer").execute()

        admin_ids = [a["id"] for a in (admin_result.data or [])]
        officer_ids = [o["id"] for o in (officer_result.data or [])]
        all_notify_ids = admin_ids + officer_ids

        for uid in all_notify_ids:
            try:
                await _send_notification_to_user(
                    user_id=uid,
                    notification_type="escalation_reminder",
                    data={
                        "count": len(complaints),
                        "village_id": village_id,
                        "complaint_ids": [c["id"] for c in complaints],
                    },
                    channels=["push", "email"],
                )
                notification_count += 1
            except Exception as e:
                logger.error(f"Escalation notification failed for {uid}: {e}")

        # Also notify for each individual complaint
        for complaint in complaints:
            for uid in all_notify_ids:
                try:
                    await _send_notification_to_user(
                        user_id=uid,
                        notification_type="complaint_escalated",
                        data={
                            "complaint_id": complaint["id"],
                            "ticket_id": complaint.get("ticket_id", ""),
                            "title": complaint.get("title", "Untitled"),
                            "reason": "No update for 7+ days",
                            "village_id": village_id,
                        },
                        channels=["push", "email"],
                    )
                except Exception as e:
                    logger.error(f"Complaint escalation notification failed: {e}")

    return {
        "success": True,
        "escalated_count": escalated_count,
        "villages_notified": len(village_complaints),
        "notifications_sent": notification_count,
    }


@app.get("/api/py/notification_service/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "GramSeva Notification Service",
        "version": "2.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
