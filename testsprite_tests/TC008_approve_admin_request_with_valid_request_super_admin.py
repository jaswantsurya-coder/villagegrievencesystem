import os
import requests

BASE_URL = os.environ.get("SUPABASE_AUX_URL", "http://localhost:54321").rstrip("/") + "/rest/v1"
APIKEY = os.environ.get("VITE_SUPABASE_AUX_ANON_KEY") or os.environ.get("SUPABASE_AUX_ANON_KEY", "")
TIMEOUT = 30


def login_super_admin():
    url = os.environ.get("SUPABASE_AUX_URL", "http://localhost:54321").rstrip("/") + "/auth/v1/token?grant_type=password"
    headers = {
        "Content-Type": "application/json",
        "apikey": APIKEY,
        "Authorization": f"Bearer {APIKEY}"
    }
    payload = {
        "email": "superadmin@example.com",
        "password": "SuperAdminPassword123!"
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    access_token = None
    if 'access_token' in data:
        access_token = data['access_token']
    elif 'session' in data and 'access_token' in data['session']:
        access_token = data['session']['access_token']
    else:
        raise AssertionError("Access token not found in login response")
    user_id = None
    if 'user' in data and 'id' in data['user']:
        user_id = data['user']['id']
    elif 'session' in data and 'user' in data['session'] and 'id' in data['session']['user']:
        user_id = data['session']['user']['id']
    else:
        raise AssertionError("User ID not found in login response")
    return access_token, user_id


def create_dummy_admin_request():
    url_create = f"{BASE_URL}/rpc/svc_create_complaint"
    complaint_payload = {
        "p_title": "Test complaint for admin request",
        "p_description": "Test description",
        "p_category": "General",
        "p_location": "Test Location",
        "p_latitude": 12.9716,
        "p_longitude": 77.5946,
        "p_photos": [],
        "p_photo_urls": [],
        "p_related_scheme": None,
        "p_is_anonymous": False,
        "p_anonymous_phone": None,
        "p_village_id": 1
    }
    resp_create = requests.post(url_create, json=complaint_payload, headers={"apikey": APIKEY}, timeout=TIMEOUT)
    resp_create.raise_for_status()
    data_create = resp_create.json()
    assert data_create.get("success", False), f"Failed to create dummy complaint: {data_create.get('error', 'unknown error')}"
    complaint_id = data_create.get("complaint_id")
    try:
        request_id = int(complaint_id)
    except Exception:
        request_id = 1
    return request_id


def delete_dummy_admin_request():
    pass


def test_approve_admin_request_with_valid_request_super_admin():
    access_token, reviewer_id = login_super_admin()
    headers = {
        "apikey": APIKEY,
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    request_id = create_dummy_admin_request()
    url = f"{BASE_URL}/rpc/svc_approve_admin_request"

    payload = {
        "p_request_id": request_id
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        data = response.json()

        assert "success" in data, "Response missing 'success' field"
        assert data["success"] is True, f"Approval failed with error: {data.get('error', 'No error message')}"
        assert "village_id" in data and isinstance(data["village_id"], int), "Response missing or invalid 'village_id'"
        assert "village_name" in data and isinstance(data["village_name"], str) and data["village_name"], "Response missing or invalid 'village_name'"
        assert "join_code" in data and isinstance(data["join_code"], str) and data["join_code"], "Response missing or invalid 'join_code'"
        assert "user_id" in data and isinstance(data["user_id"], str) and data["user_id"], "Response missing or invalid 'user_id'"

    finally:
        delete_dummy_admin_request()


test_approve_admin_request_with_valid_request_super_admin()

