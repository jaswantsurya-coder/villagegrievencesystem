import requests
import random

BASE_URL = "https://dtucrczgagpzjbbrwqit.supabase.co/rest/v1"
APIKEY = "sb_publishable_k0ti3YbQtd3y7J2cHF8yMA_HnRa1bhK"
HEADERS = {
    "apikey": APIKEY,
    "Content-Type": "application/json"
}
TIMEOUT = 30

def signup_citizen_user():
    phone = "+91999999" + str(random.randint(1000, 9999))
    signup_url = "https://dtucrczgagpzjbbrwqit.supabase.co/auth/v1/signup"
    payload = {
        "phone": phone,
        "password": "TestPassword123!"
    }
    resp = requests.post(signup_url, json=payload, headers={"apikey": APIKEY, "Content-Type": "application/json"}, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    access_token = None
    if "session" in data and "access_token" in data["session"]:
        access_token = data["session"]["access_token"]
    elif "access_token" in data:
        access_token = data["access_token"]
    if not access_token:
        raise ValueError("Failed to get access_token from signup response")
    return access_token

def test_create_complaint_with_anonymous_submission():
    # No authentication required per PRD to create complaint (p_is_anonymous true)
    url = f"{BASE_URL}/rpc/svc_create_complaint"
    headers = HEADERS.copy()
    # Construct payload with all required params, including nulls where appropriate
    # Using Bangalore location lat/lng to hit village_id 1 as per seeded data
    payload = {
        "p_title": "Anonymous Complaint Test",
        "p_description": "Testing anonymous complaint submission without reporter identity.",
        "p_category": "Infrastructure",
        "p_location": "Near MG Road",
        "p_latitude": 12.9716,
        "p_longitude": 77.5946,
        "p_photos": [],
        "p_photo_urls": [],
        "p_related_scheme": None,
        "p_is_anonymous": True,
        "p_anonymous_phone": "+911234567890",
        "p_village_id": 1
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT)
        response.raise_for_status()
        data = response.json()

        assert isinstance(data, dict), "Response is not a JSON object"
        assert "success" in data, "'success' field missing in response"
        assert data["success"] is True, f"Complaint creation not successful: {data.get('error', '')}"
        assert "complaint_id" in data and isinstance(data["complaint_id"], str) and data["complaint_id"].strip(), "Missing or invalid complaint_id"
        assert "ticket_id" in data and isinstance(data["ticket_id"], str) and data["ticket_id"].strip(), "Missing or invalid ticket_id"
        # Ensure no identity fields exposed (cannot check directly here because response schema doesn't include reporter identity)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_create_complaint_with_anonymous_submission()