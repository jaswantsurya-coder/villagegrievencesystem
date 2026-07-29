"""
GramSeva — WhatsApp Sender Integration (Stub)
Designed to use Meta WhatsApp Cloud API in the future.
"""

import os
import logging
import httpx

logger = logging.getLogger("gramseva.whatsapp_sender")

WHATSAPP_ENABLED = os.environ.get("WHATSAPP_ENABLED", "false").lower() == "true"
WHATSAPP_API_URL = os.environ.get("WHATSAPP_API_URL", "")
WHATSAPP_API_TOKEN = os.environ.get("WHATSAPP_API_TOKEN", "")

async def send_whatsapp_message(to_phone: str, message: str) -> dict:
    """
    Sends a WhatsApp message via Meta Cloud API.
    Currently acts as a stub if WHATSAPP_ENABLED is false.
    """
    if not WHATSAPP_ENABLED:
        logger.info(f"WhatsApp is disabled. Would have sent to {to_phone}: {message[:50]}...")
        return {"success": True, "message_id": "stub_wa_id", "status": "stubbed"}

    if not WHATSAPP_API_URL or not WHATSAPP_API_TOKEN:
        logger.error("WhatsApp is enabled but API credentials are missing.")
        return {"success": False, "error": "Missing WhatsApp credentials"}

    try:
        # Example implementation for Meta WhatsApp Cloud API
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "text",
            "text": {"body": message}
        }
        headers = {
            "Authorization": f"Bearer {WHATSAPP_API_TOKEN}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(WHATSAPP_API_URL, json=payload, headers=headers, timeout=10.0)
            
        if response.status_code in (200, 201):
            data = response.json()
            # Meta returns a list of messages
            msg_id = data.get("messages", [{}])[0].get("id", "unknown")
            return {"success": True, "message_id": msg_id}
        else:
            return {"success": False, "error": f"HTTP {response.status_code}: {response.text}"}

    except Exception as e:
        logger.error(f"Failed to send WhatsApp message: {e}")
        return {"success": False, "error": str(e)}
