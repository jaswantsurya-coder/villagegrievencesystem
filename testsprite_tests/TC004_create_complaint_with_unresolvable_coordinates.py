import os
import requests
import random

BASE_URL = os.environ.get("SUPABASE_AUX_URL", "http://localhost:54321").rstrip("/") + "/rest/v1"
API_KEY = os.environ.get("VITE_SUPABASE_AUX_ANON_KEY") or os.environ.get("SUPABASE_AUX_ANON_KEY", "")
TIMEOUT = 30

def test_create_complaint_with_unresolvable_coordinates():
    # Signup a new user with phone authentication
    signup_url = os.environ.get("SUPABASE_AUX_URL", "http://localhost:54321").rstrip("/") + "/auth/v1/signup"
    phone_number = "+91999999" + str(random.randint(1000, 9999))
    signup_payload = {
        "phone": phone_number,
        "password": "TestPassword123!"
    }
    signup_headers = {
        "apikey": API_KEY,
        "Content-Type": "application/json"
    }
    resp = requests.post(signup_url, json=signup_payload, headers=signup_headers, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Signup failed with status: {resp.status_code}"
    data = resp.json()
    access_token = None
    if 'session' in data and 'access_token' in data['session']:
        access_token = data['session']['access_token']
    elif 'access_token' in data:
        access_token = data['access_token']
    assert access_token, "Failed to get access token from signup response"

    # Prepare headers for authenticated requests (though this endpoint does not require auth, follow pattern)
    headers = {
        "apikey": API_KEY,
        "Authorization": "Bearer " + access_token,
        "Content-Type": "application/json"
    }

    # Prepare payload with coordinates that do not resolve to a known village boundary
    # Use coordinates far from any known seeded village, e.g., lat=0.0, lng=0.0
    payload = {
        "p_title": "Test Complaint Unresolvable Coordinates",
        "p_description": "Complaint with coordinates outside any village boundary.",
        "p_category": "Infrastructure",
        "p_location": "Unknown Location",
        "p_latitude": 0.0,
        "p_longitude": 0.0,
        "p_photos": [],
        "p_photo_urls": [],
        "p_related_scheme": None,
        "p_is_anonymous": False,
        "p_anonymous_phone": None,
        "p_village_id": None
    }

    url = f"{BASE_URL}/rpc/svc_create_complaint"
    try:
        response = requests.post(url, json=payload, headers={"apikey": API_KEY}, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to svc_create_complaint failed: {e}"

    assert response.status_code == 200, f"svc_create_complaint returned status {response.status_code}"
    resp_json = response.json()

    # The API should return success false OR error indicating routing failure and complaint shouldn't be created
    success = resp_json.get("success", True)
    error = resp_json.get("error", "")
    complaint_id = resp_json.get("complaint_id")
    ticket_id = resp_json.get("ticket_id")

    assert (success is False) or (error != ""), (
        "Expected failure or error for unresolvable coordinates, but got success=true without error."
    )
    assert complaint_id is None, "Complaint ID should not be returned on failure."
    assert ticket_id is None, "Ticket ID should not be returned on failure."


test_create_complaint_with_unresolvable_coordinates()
