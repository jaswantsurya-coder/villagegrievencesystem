"""
GramSeva — Firebase Cloud Messaging Push Notification Sender
Sends FCM push notifications to individual users, roles, or village groups.
"""

import os
import json
import logging
from typing import Optional

import firebase_admin
from firebase_admin import credentials, messaging

logger = logging.getLogger("gramseva.firebase_push")

_firebase_initialized = False


def _ensure_firebase():
    """Initialize Firebase Admin SDK if not already done."""
    global _firebase_initialized
    if _firebase_initialized:
        return

    # Option 1: Service account JSON from environment variable
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if sa_json:
        try:
            sa_dict = json.loads(sa_json)
            cred = credentials.Certificate(sa_dict)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            logger.info("Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT_JSON")
            return
        except Exception as e:
            logger.error(f"Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: {e}")

    # Option 2: Service account file path
    sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")
    if sa_path and os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
        firebase_admin.initialize_app(cred)
        _firebase_initialized = True
        logger.info(f"Firebase Admin initialized from {sa_path}")
        return

    # Option 3: Default credentials (GCE, Cloud Run, etc.)
    try:
        firebase_admin.initialize_app()
        _firebase_initialized = True
        logger.info("Firebase Admin initialized with default credentials")
    except Exception as e:
        logger.error(f"Firebase Admin initialization failed: {e}")
        raise RuntimeError(
            "Firebase Admin SDK not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON "
            "or FIREBASE_SERVICE_ACCOUNT_PATH environment variable."
        )


def send_push_notification(
    fcm_token: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
    image_url: Optional[str] = None,
) -> dict:
    """
    Send a push notification to a single FCM token.
    
    Returns:
        dict with 'success', 'message_id' or 'error', and 'invalid_token' flag
    """
    _ensure_firebase()

    notification = messaging.Notification(
        title=title,
        body=body,
        image=image_url,
    )

    # Build data payload (all values must be strings)
    data_payload = {}
    if data:
        for k, v in data.items():
            data_payload[k] = str(v) if v is not None else ""

    # Android-specific configuration
    android_config = messaging.AndroidConfig(
        priority="high",
        notification=messaging.AndroidNotification(
            click_action="FLUTTER_NOTIFICATION_CLICK",
            channel_id="gramseva_notifications",
        ),
    )

    # Web push configuration
    webpush_config = messaging.WebpushConfig(
        notification=messaging.WebpushNotification(
            title=title,
            body=body,
            icon="/images/icon-192.png",
            badge="/images/badge-72.png",
            require_interaction=data_payload.get("require_interaction") == "true",
        ),
        fcm_options=messaging.WebpushFCMOptions(
            link=data_payload.get("action_url", "/"),
        ),
    )

    message = messaging.Message(
        notification=notification,
        data=data_payload,
        token=fcm_token,
        android=android_config,
        webpush=webpush_config,
    )

    try:
        message_id = messaging.send(message)
        logger.info(f"FCM sent to token ...{fcm_token[-8:]}: {message_id}")
        return {"success": True, "message_id": message_id, "invalid_token": False}
    except messaging.UnregisteredError:
        logger.warning(f"FCM token unregistered: ...{fcm_token[-8:]}")
        return {"success": False, "error": "Token unregistered", "invalid_token": True}
    except messaging.SenderIdMismatchError:
        logger.warning(f"FCM sender ID mismatch for token: ...{fcm_token[-8:]}")
        return {"success": False, "error": "Sender ID mismatch", "invalid_token": True}
    except messaging.InvalidArgumentError as e:
        logger.error(f"FCM invalid argument: {e}")
        return {"success": False, "error": str(e), "invalid_token": True}
    except Exception as e:
        logger.error(f"FCM send failed: {e}")
        return {"success": False, "error": str(e), "invalid_token": False}


def send_push_to_multiple(
    fcm_tokens: list[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> dict:
    """
    Send push notification to multiple FCM tokens.
    
    Returns:
        dict with 'success_count', 'failure_count', 'invalid_tokens' list
    """
    _ensure_firebase()

    if not fcm_tokens:
        return {"success_count": 0, "failure_count": 0, "invalid_tokens": []}

    notification = messaging.Notification(title=title, body=body)

    data_payload = {}
    if data:
        for k, v in data.items():
            data_payload[k] = str(v) if v is not None else ""

    message = messaging.MulticastMessage(
        notification=notification,
        data=data_payload,
        tokens=fcm_tokens,
        webpush=messaging.WebpushConfig(
            notification=messaging.WebpushNotification(
                title=title,
                body=body,
                icon="/images/icon-192.png",
                badge="/images/badge-72.png",
            ),
        ),
    )

    try:
        response = messaging.send_each_for_multicast(message)

        invalid_tokens = []
        for idx, send_response in enumerate(response.responses):
            if send_response.exception:
                exc = send_response.exception
                if isinstance(exc, (
                    messaging.UnregisteredError,
                    messaging.SenderIdMismatchError,
                    messaging.InvalidArgumentError,
                )):
                    invalid_tokens.append(fcm_tokens[idx])

        logger.info(
            f"FCM multicast: {response.success_count} sent, "
            f"{response.failure_count} failed, "
            f"{len(invalid_tokens)} invalid tokens"
        )

        return {
            "success_count": response.success_count,
            "failure_count": response.failure_count,
            "invalid_tokens": invalid_tokens,
        }
    except Exception as e:
        logger.error(f"FCM multicast failed: {e}")
        return {
            "success_count": 0,
            "failure_count": len(fcm_tokens),
            "invalid_tokens": [],
            "error": str(e),
        }
