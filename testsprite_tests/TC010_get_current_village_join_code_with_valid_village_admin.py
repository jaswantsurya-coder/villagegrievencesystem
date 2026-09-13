import os
import requests

def test_get_current_village_join_code_with_valid_village_admin():
    BASE_URL = os.environ.get("SUPABASE_AUX_URL", "http://localhost:54321").rstrip("/") + "/rest/v1"
    auth_url = os.environ.get("SUPABASE_AUX_URL", "http://localhost:54321").rstrip("/") + "/auth/v1/token"
    APIKEY = os.environ.get("VITE_SUPABASE_AUX_ANON_KEY") or os.environ.get("SUPABASE_AUX_ANON_KEY", "")
    village_id = 1  # Pre-seeded village

    # Step 1: Authenticate as Village Admin with password token login
    auth_headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "apikey": apikey
    }
    auth_payload = {
        "grant_type": "password",
        "email": "admin@example.com",
        "password": "AdminPassword123!"
    }
    try:
        auth_resp = requests.post(auth_url, data=auth_payload, headers=auth_headers, timeout=30)
        auth_resp.raise_for_status()
    except Exception as e:
        raise AssertionError(f"Authentication request failed: {e}")

    auth_data = auth_resp.json()
    access_token = None
    # Extract access_token per rules
    if "access_token" in auth_data:
        access_token = auth_data["access_token"]
    elif "session" in auth_data and "access_token" in auth_data["session"]:
        access_token = auth_data["session"]["access_token"]
    if not access_token:
        raise AssertionError("Access token not found in authentication response")

    # Step 2: Request current village join code with authenticated admin
    headers = {
        "apikey": apikey,
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "p_id": village_id
    }

    try:
        resp = requests.post(f"{base_url}/rpc/get_current_village_join_code", json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        raise AssertionError(f"Request to get_current_village_join_code failed: {e}")

    # Response expected is a string (the join code)
    join_code = resp.text.strip('"')  # Remove quotes in case response is a JSON string literal

    # Assertions
    assert resp.status_code == 200, f"Expected status 200 but got {resp.status_code}"
    assert isinstance(join_code, str), "Join code is not a string"
    assert join_code != "", "Join code is empty"
    assert join_code == "GSV12345", f"Join code mismatch, expected 'GSV12345' but got '{join_code}'"

test_get_current_village_join_code_with_valid_village_admin()

