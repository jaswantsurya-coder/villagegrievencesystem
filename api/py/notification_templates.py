"""
GramSeva — Notification Templates
HTML email and push notification content for every notification type.
Centralized so push, email, and future WhatsApp reuse the same content.
"""


def get_notification_content(notification_type: str, data: dict) -> dict:
    """
    Generate notification content for all channels.
    
    Args:
        notification_type: One of the supported notification types
        data: Context data (complaint_id, ticket_id, title, village_name, etc.)
    
    Returns:
        dict with 'subject', 'title', 'body', 'html', 'action_url', 'require_interaction'
    """
    templates = {
        # ─── Complaint Lifecycle ──────────────────────────────────────────
        "complaint_submitted": {
            "subject": f"[GramSeva] Complaint Registered — {data.get('ticket_id', '')}",
            "title": "✅ Complaint Registered",
            "body": f"Your complaint \"{data.get('title', '')}\" has been submitted. Ticket ID: {data.get('ticket_id', '')}.",
            "action_url": f"/?view=track&ticket={data.get('ticket_id', '')}",
            "require_interaction": False,
        },
        "complaint_assigned": {
            "subject": f"[GramSeva] Complaint Assigned — {data.get('ticket_id', '')}",
            "title": "👤 Complaint Assigned",
            "body": f"Complaint \"{data.get('title', '')}\" ({data.get('ticket_id', '')}) has been assigned to {data.get('officer_name', 'an officer')}.",
            "action_url": f"/?view=track&ticket={data.get('ticket_id', '')}",
            "require_interaction": False,
        },
        "complaint_updated": {
            "subject": f"[GramSeva] Complaint Updated — {data.get('ticket_id', '')}",
            "title": "🔄 Complaint Updated",
            "body": f"Complaint \"{data.get('title', '')}\" status changed to {data.get('new_status', 'Updated')}.",
            "action_url": f"/?view=track&ticket={data.get('ticket_id', '')}",
            "require_interaction": False,
        },
        "complaint_resolved": {
            "subject": f"[GramSeva] Complaint Resolved — {data.get('ticket_id', '')}",
            "title": "🎉 Complaint Resolved",
            "body": f"Good news! Your complaint \"{data.get('title', '')}\" has been resolved. Please rate the resolution.",
            "action_url": f"/?view=track&ticket={data.get('ticket_id', '')}",
            "require_interaction": False,
        },
        "complaint_rejected": {
            "subject": f"[GramSeva] Complaint Update — {data.get('ticket_id', '')}",
            "title": "⚠️ Complaint Rejected",
            "body": f"Complaint \"{data.get('title', '')}\" could not be processed. Reason: {data.get('reason', 'Not specified')}.",
            "action_url": f"/?view=track&ticket={data.get('ticket_id', '')}",
            "require_interaction": True,
        },
        "complaint_reopened": {
            "subject": f"[GramSeva] Complaint Reopened — {data.get('ticket_id', '')}",
            "title": "🔁 Complaint Reopened",
            "body": f"Complaint \"{data.get('title', '')}\" has been reopened for further action.",
            "action_url": f"/?view=track&ticket={data.get('ticket_id', '')}",
            "require_interaction": False,
        },
        "complaint_escalated": {
            "subject": f"[GramSeva] ⚠️ Complaint Escalated — {data.get('ticket_id', '')}",
            "title": "🔥 Complaint Escalated",
            "body": f"Complaint \"{data.get('title', '')}\" has been escalated due to {data.get('reason', 'no action for 7 days')}.",
            "action_url": f"/?view=admin",
            "require_interaction": True,
        },

        # ─── Admin Requests ───────────────────────────────────────────────
        "admin_request_submitted": {
            "subject": f"[GramSeva] New Admin Request — {data.get('village_name', '')}",
            "title": "📋 New Admin Request",
            "body": f"{data.get('applicant_name', 'A user')} has submitted an admin request for {data.get('village_name', 'a village')}.",
            "action_url": "/?view=admin",
            "require_interaction": False,
        },
        "admin_request_approved": {
            "subject": f"[GramSeva] 🎉 Admin Request Approved — {data.get('village_name', '')}",
            "title": "✅ Admin Request Approved",
            "body": f"Your admin request for {data.get('village_name', 'the village')} has been approved! You now have Village Admin access.",
            "action_url": "/?view=admin",
            "require_interaction": True,
        },
        "admin_request_rejected": {
            "subject": f"[GramSeva] Admin Request Update — {data.get('village_name', '')}",
            "title": "❌ Admin Request Rejected",
            "body": f"Your admin request for {data.get('village_name', 'the village')} was not approved. Reason: {data.get('reason', 'Not specified')}.",
            "action_url": "/",
            "require_interaction": True,
        },

        # ─── Help Desk ────────────────────────────────────────────────────
        "help_ticket_new": {
            "subject": f"[GramSeva] New Help Ticket — {data.get('subject', '')}",
            "title": "🎫 New Help Ticket",
            "body": f"A new help ticket has been submitted: \"{data.get('subject', 'Support request')}\".",
            "action_url": "/?view=admin",
            "require_interaction": False,
        },

        # ─── OTP & Auth ──────────────────────────────────────────────────
        "otp_verification": {
            "subject": f"[GramSeva] Your OTP Code: {data.get('otp', '')}",
            "title": "🔐 OTP Verification",
            "body": f"Your GramSeva verification code is: {data.get('otp', '')}. Valid for {data.get('expires_in', '10')} minutes.",
            "action_url": "/",
            "require_interaction": True,
        },

        # ─── Profile ─────────────────────────────────────────────────────
        "profile_update": {
            "subject": "[GramSeva] Profile Updated",
            "title": "👤 Profile Updated",
            "body": f"Your profile has been updated: {data.get('changes', 'role or village assignment changed')}.",
            "action_url": "/?view=profile",
            "require_interaction": False,
        },

        # ─── System Notifications ─────────────────────────────────────────
        "terms_update": {
            "subject": "[GramSeva] Terms of Service Updated",
            "title": "📄 Terms Updated",
            "body": "GramSeva Terms of Service have been updated. Please review the changes.",
            "action_url": "/",
            "require_interaction": False,
        },
        "privacy_update": {
            "subject": "[GramSeva] Privacy Policy Updated",
            "title": "🔒 Privacy Policy Updated",
            "body": "GramSeva Privacy Policy has been updated. Please review the changes.",
            "action_url": "/",
            "require_interaction": False,
        },
        "maintenance_notice": {
            "subject": f"[GramSeva] Scheduled Maintenance — {data.get('date', '')}",
            "title": "🔧 Maintenance Notice",
            "body": f"GramSeva will undergo maintenance on {data.get('date', 'the scheduled date')}. {data.get('details', '')}",
            "action_url": "/",
            "require_interaction": True,
        },
        "announcement": {
            "subject": f"[GramSeva] {data.get('title', 'Announcement')}",
            "title": f"📢 {data.get('title', 'Announcement')}",
            "body": data.get("body", "You have a new announcement from GramSeva."),
            "action_url": "/",
            "require_interaction": False,
        },

        # ─── Escalation Reminder ──────────────────────────────────────────
        "escalation_reminder": {
            "subject": f"[GramSeva] ⚠️ {data.get('count', 0)} Complaints Need Attention",
            "title": f"⚠️ {data.get('count', 0)} Unattended Complaints",
            "body": f"You have {data.get('count', 0)} complaints that haven't been updated in 7+ days. Immediate action required.",
            "action_url": "/?view=admin",
            "require_interaction": True,
        },
    }

    template = templates.get(notification_type, {
        "subject": "[GramSeva] Notification",
        "title": "GramSeva",
        "body": data.get("body", "You have a new notification."),
        "action_url": "/",
        "require_interaction": False,
    })

    # Generate HTML email content
    template["html"] = _build_email_html(
        title=template["title"],
        body=template["body"],
        action_url=template.get("action_url", "/"),
        notification_type=notification_type,
        data=data,
    )

    return template


def _build_email_html(
    title: str,
    body: str,
    action_url: str,
    notification_type: str,
    data: dict,
) -> str:
    """Build a styled HTML email body."""

    # Pick header color based on notification category
    if "escalat" in notification_type or "reject" in notification_type:
        header_bg = "#dc2626"
        header_text = "#ffffff"
    elif "resolved" in notification_type or "approved" in notification_type:
        header_bg = "#16a34a"
        header_text = "#ffffff"
    elif "submitted" in notification_type or "assigned" in notification_type:
        header_bg = "#0284c7"
        header_text = "#ffffff"
    else:
        header_bg = "#0284c7"
        header_text = "#ffffff"

    # Build detail rows
    detail_rows = ""
    if data.get("ticket_id"):
        detail_rows += f'<tr><td style="padding:6px 12px;font-weight:700;color:#475569;">Ticket ID</td><td style="padding:6px 12px;">{data["ticket_id"]}</td></tr>'
    if data.get("village_name"):
        detail_rows += f'<tr><td style="padding:6px 12px;font-weight:700;color:#475569;">Village</td><td style="padding:6px 12px;">{data["village_name"]}</td></tr>'
    if data.get("category"):
        detail_rows += f'<tr><td style="padding:6px 12px;font-weight:700;color:#475569;">Category</td><td style="padding:6px 12px;">{data["category"]}</td></tr>'
    if data.get("new_status"):
        detail_rows += f'<tr><td style="padding:6px 12px;font-weight:700;color:#475569;">Status</td><td style="padding:6px 12px;">{data["new_status"]}</td></tr>'

    app_url = data.get("app_url", "https://villagegrievencesystem-2uvj.vercel.app")
    full_action_url = f"{app_url}{action_url}" if action_url.startswith("/") else action_url

    details_section = ""
    if detail_rows:
        details_section = f"""
        <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:8px;">
            {detail_rows}
        </table>
        """

    return f"""
    <div style="font-family:'Inter',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:{header_bg};padding:24px 28px;text-align:center;">
            <h1 style="margin:0;color:{header_text};font-size:20px;font-weight:800;">{title}</h1>
        </div>
        <div style="padding:24px 28px;">
            <p style="margin:0 0 16px;color:#0f172a;font-size:15px;line-height:1.6;">{body}</p>
            {details_section}
            <div style="text-align:center;margin:24px 0 8px;">
                <a href="{full_action_url}" style="display:inline-block;background:{header_bg};color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
                    View Details
                </a>
            </div>
        </div>
        <div style="background:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
                GramSeva — Digital Gram Panchayat Grievance System<br/>
                This is an automated notification. Please do not reply to this email.
            </p>
        </div>
    </div>
    """
