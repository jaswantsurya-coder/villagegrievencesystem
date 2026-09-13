import os
import requests
import random

BASE_URL = os.environ.get("SUPABASE_AUX_URL", "http://localhost:54321").rstrip("/") + "/rest/v1"
APIKEY = os.environ.get("VITE_SUPABASE_AUX_ANON_KEY") or os.environ.get("SUPABASE_AUX_ANON_KEY", "")
TIMEOUT = 30


def test_join_village_with_invalid_code_authenticated():
    # Step 1: Sign up a new user with phone authentication
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
    signup_response = requests.post(signup_url, json=signup_payload, headers=signup_headers, timeout=TIMEOUT)
    assert signup_response.status_code == 200, f"Signup failed with status {signup_response.status_code}"
    signup_data = signup_response.json()

    # Extract access_token for authentication
    access_token = None
    if "session" in signup_data and signup_data["session"]:
        access_token = signup_data["session"].get("access_token")
    if not access_token:
        access_token = signup_data.get("access_token")
    assert access_token is not None, "access_token not found in signup response"

    auth_headers = {
        "apikey": APIKEY,
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    # Step 2: Call POST /rpc/svc_join_village with invalid join code while authenticated
    join_village_url = f"{BASE_URL}/rpc/svc_join_village"
    invalid_code = "INVALIDCODE123"
    join_payload = {
        "p_code": invalid_code
    }

    response = requests.post(join_village_url, json=join_payload, headers=auth_headers, timeout=TIMEOUT)
    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
    resp_json = response.json()

    # Step 3: Validate that success is false, error message is present, and no village membership assigned
    assert isinstance(resp_json, dict), "Response JSON is not a dictionary"
    assert resp_json.get("success") is False, "Expected success to be False for invalid join code"
    assert "error" in resp_json and resp_json["error"], "Expected an error message for invalid join code"
    # village_id or village_name should not be assigned (either missing or None)
    village_id = resp_json.get("village_id")
    village_name = resp_json.get("village_name")
    assert village_id in (None, 0), f"Expected village_id to be None or 0 but got {village_id}"
    assert village_name in (None, ""), f"Expected village_name to be None or empty but got {village_name}"


test_join_village_with_invalid_code_authenticated()
