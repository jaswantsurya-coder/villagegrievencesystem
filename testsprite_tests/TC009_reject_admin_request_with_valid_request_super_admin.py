import os
import requests

BASE_URL = os.environ.get("SUPABASE_AUX_URL", "http://localhost:54321").rstrip("/") + "/rest/v1"
API_KEY = os.environ.get("VITE_SUPABASE_AUX_ANON_KEY") or os.environ.get("SUPABASE_AUX_ANON_KEY", "")
SUPERADMIN_EMAIL = "superadmin@example.com"
SUPERADMIN_PASSWORD = "SuperAdminPassword123!"

def test_reject_admin_request_with_valid_request_super_admin():
    # Authenticate as Super Admin (password token login)
    auth_url = os.environ.get("SUPABASE_AUX_URL", "http://localhost:54321").rstrip("/") + "/auth/v1/token?grant_type=password"
    auth_headers = {
        "Content-Type": "application/json",
        "apikey": API_KEY
    }
    auth_payload = {
        "email": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    }
    auth_resp = requests.post(auth_url, json=auth_payload, headers=auth_headers, timeout=30)
    assert auth_resp.status_code == 200, f"Super Admin auth failed: {auth_resp.text}"
    auth_data = auth_resp.json()
    access_token = auth_data.get("access_token") or (auth_data.get("session") or {}).get("access_token")
    user_id = (auth_data.get("user") or (auth_data.get("session") or {}).get("user") or {}).get("id")
    assert access_token, "No access token found in Super Admin auth response"
    assert user_id, "No user id found in Super Admin auth response"

    headers = {
        "apikey": API_KEY,
        "Authorization": "Bearer " + access_token,
        "Content-Type": "application/json"
    }

    # Step 1: Create a new complaint (unauthenticated) to get a complaint_id (request_id)
    complaint_payload = {
        "p_title": "Test complaint for admin request rejection",
        "p_description": "Complaint description for TC009",
        "p_category": "General",
        "p_location": "Bangalore",
        "p_latitude": 12.9716,
        "p_longitude": 77.5946,
        "p_photos": [],
        "p_photo_urls": [],
        "p_related_scheme": None,
        "p_is_anonymous": False,
        "p_anonymous_phone": None,
        "p_village_id": 1
    }
    complaint_resp = requests.post(
        f"{BASE_URL}/rpc/svc_create_complaint",
        json=complaint_payload,
        headers={"apikey": API_KEY},
        timeout=30
    )
    assert complaint_resp.status_code == 200, f"Complaint creation failed: {complaint_resp.text}"
    complaint_data = complaint_resp.json()
    assert complaint_data.get("success") is True, f"Complaint creation was not successful: {complaint_data}"
    complaint_id = complaint_data.get("complaint_id")
    assert complaint_id, "No complaint_id returned"

    # Step 2: Convert complaint_id to integer or fallback to 1
    try:
        request_id_int = int(complaint_id)
    except Exception:
        request_id_int = 1

    # Step 3: Call svc_reject_admin_request with valid request_id as Super Admin
    reject_payload = {
        "p_request_id": request_id_int
    }
    reject_resp = requests.post(
        f"{BASE_URL}/rpc/svc_reject_admin_request",
        json=reject_payload,
        headers=headers,
        timeout=30
    )
    assert reject_resp.status_code == 200, f"Reject admin request call failed: {reject_resp.text}"
    reject_data = reject_resp.json()
    assert reject_data.get("success") is True, f"Reject admin request failed or denied: {reject_data}"

test_reject_admin_request_with_valid_request_super_admin()

