import os
import requests
import random

BASE_URL = os.environ.get("SUPABASE_AUX_URL", "http://localhost:54321").rstrip("/") + "/rest/v1"
APIKEY = os.environ.get("VITE_SUPABASE_AUX_ANON_KEY") or os.environ.get("SUPABASE_AUX_ANON_KEY", "")
TIMEOUT = 30

def test_create_complaint_with_valid_data():
    # Step 1: Signup a new user via phone to get access_token
    signup_url = os.environ.get("SUPABASE_AUX_URL", "http://localhost:54321").rstrip("/") + "/auth/v1/signup"
    phone_number = "+91999999" + str(random.randint(1000, 9999))
    signup_payload = {
        "phone": phone_number,
        "password": "TestPassword123!"
    }
    signup_headers = {
        "apikey": APIKEY,
        "Content-Type": "application/json"
    }
    try:
        signup_resp = requests.post(signup_url, json=signup_payload, headers=signup_headers, timeout=TIMEOUT)
        signup_resp.raise_for_status()
        data = signup_resp.json()
        access_token = None
        # Extract access_token from possible locations
        if 'session' in data and data['session'] and 'access_token' in data['session']:
            access_token = data['session']['access_token']
        elif 'access_token' in data:
            access_token = data['access_token']
        else:
            raise Exception("access_token not found in signup response")
        assert access_token is not None and len(access_token) > 0
    except Exception as e:
        raise AssertionError(f"Signup failed: {e}")

    # Step 2: Prepare complaint payload with valid data and required fields (including nulls where applicable)
    complaint_payload = {
        "p_title": "Pothole Issue on Main Street",
        "p_description": "There is a large pothole causing issues for vehicles.",
        "p_category": "Infrastructure",
        "p_location": "Main Street near market",
        "p_latitude": 12.9716,
        "p_longitude": 77.5946,
        "p_photos": [],           # no photos
        "p_photo_urls": [],       # no photo urls
        "p_related_scheme": None, # no related scheme
        "p_is_anonymous": False,
        "p_anonymous_phone": None,
        "p_village_id": 1
    }

    # Step 3: Make POST request to svc_create_complaint RPC endpoint
    url = f"{BASE_URL}/rpc/svc_create_complaint"
    headers = {
        "apikey": APIKEY,
        "Authorization": "Bearer " + access_token,
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, json=complaint_payload, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        resp_json = response.json()

        # Step 4: Validate response content
        assert resp_json.get("success") is True, f"Expected success True, got {resp_json.get('success')}"
        complaint_id = resp_json.get("complaint_id")
        ticket_id = resp_json.get("ticket_id")
        error = resp_json.get("error")
        assert complaint_id is not None and isinstance(complaint_id, str) and complaint_id != ""
        assert ticket_id is not None and isinstance(ticket_id, str) and ticket_id != ""
        assert error is None or error == ""

    except Exception as e:
        raise AssertionError(f"Complaint creation failed or invalid response: {e}")

test_create_complaint_with_valid_data()
