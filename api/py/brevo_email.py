"""
GramSeva — Brevo (Sendinblue) SMTP Email Sender
Sends transactional emails via Brevo REST API.
"""

import os
import logging
from typing import Optional

import httpx

logger = logging.getLogger("gramseva.brevo_email")

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


def _get_brevo_config() -> dict:
    """Get Brevo configuration from environment variables."""
    api_key = os.environ.get("BREVO_API_KEY")
    if not api_key:
        raise RuntimeError("BREVO_API_KEY environment variable is not set")

    return {
        "api_key": api_key,
        "sender_email": os.environ.get("BREVO_SENDER_EMAIL", "gramseva0089@gmail.com"),
        "sender_name": os.environ.get("BREVO_SENDER_NAME", "GramSeva"),
    }


async def send_email(
    to_email: str,
    to_name: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    reply_to_email: Optional[str] = None,
    tags: Optional[list[str]] = None,
) -> dict:
    """
    Send a transactional email via Brevo SMTP API.
    
    Returns:
        dict with 'success', 'message_id' or 'error'
    """
    try:
        config = _get_brevo_config()
    except RuntimeError as e:
        logger.error(str(e))
        return {"success": False, "error": str(e)}

    payload = {
        "sender": {
            "name": config["sender_name"],
            "email": config["sender_email"],
        },
        "to": [{"email": to_email, "name": to_name or to_email}],
        "subject": subject,
        "htmlContent": html_content,
    }

    if text_content:
        payload["textContent"] = text_content

    if reply_to_email:
        payload["replyTo"] = {"email": reply_to_email}

    if tags:
        payload["tags"] = tags

    headers = {
        "api-key": config["api_key"],
        "Content-Type": "application/json",
        "accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(BREVO_API_URL, json=payload, headers=headers)

        if response.status_code in (200, 201):
            result = response.json()
            message_id = result.get("messageId", "")
            logger.info(f"Brevo email sent to {to_email}: {message_id}")
            return {"success": True, "message_id": message_id}
        else:
            error_body = response.text
            logger.error(f"Brevo API error {response.status_code}: {error_body}")
            return {
                "success": False,
                "error": f"Brevo API {response.status_code}: {error_body}",
            }
    except httpx.TimeoutException:
        logger.error(f"Brevo timeout sending to {to_email}")
        return {"success": False, "error": "Email send timeout"}
    except Exception as e:
        logger.error(f"Brevo send failed: {e}")
        return {"success": False, "error": str(e)}


async def send_email_batch(
    recipients: list[dict],
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
) -> dict:
    """
    Send the same email to multiple recipients.
    
    Args:
        recipients: List of dicts with 'email' and 'name' keys
        
    Returns:
        dict with 'success_count', 'failure_count', 'errors'
    """
    success_count = 0
    failure_count = 0
    errors = []

    for recipient in recipients:
        result = await send_email(
            to_email=recipient["email"],
            to_name=recipient.get("name", ""),
            subject=subject,
            html_content=html_content,
            text_content=text_content,
        )
        if result["success"]:
            success_count += 1
        else:
            failure_count += 1
            errors.append({
                "email": recipient["email"],
                "error": result.get("error", "Unknown error"),
            })

    return {
        "success_count": success_count,
        "failure_count": failure_count,
        "errors": errors,
    }
