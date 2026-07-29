import requests
import random

BASE_URL = "https://dtucrczgagpzjbbrwqit.supabase.co/rest/v1"
API_KEY = "sb_publishable_k0ti3YbQtd3y7J2cHF8yMA_HnRa1bhK"
HEADERS_COMMON = {
    "apikey": API_KEY,
    "Content-Type": "application/json"
}

def test_join_village_with_valid_code_authenticated():
    signup_url = "https://dtucrczgagpzjbbrwqit.supabase.co/auth/v1/signup"
    phone_number = "+91999999" + str(random.randint(1000, 9999))
    signup_payload = {
        "phone": phone_number,
        "password": "TestPassword123!"
    }

    # Sign up user via phone to get access_token
    try:
        signup_resp = requests.post(signup_url, json=signup_payload, headers={"apikey": API_KEY}, timeout=30)
        signup_resp.raise_for_status()
        data = signup_resp.json()
        # Extract access_token
        access_token = None
        if 'session' in data and data['session']:
            access_token = data['session'].get('access_token')
        elif 'access_token' in data:
            access_token = data.get('access_token')
        assert access_token is not None, "Access token not found in signup response"
    except Exception as e:
        raise RuntimeError(f"User signup failed: {e}")

    auth_headers = {
        **HEADERS_COMMON,
        "Authorization": f"Bearer {access_token}"
    }

    join_payload = {
        "p_code": "GSV12345"
    }

    # Call svc_join_village RPC with valid code and authorization
    join_url = f"{BASE_URL}/rpc/svc_join_village"
    try:
        join_resp = requests.post(join_url, json=join_payload, headers=auth_headers, timeout=30)
        join_resp.raise_for_status()
        join_data = join_resp.json()
        # Validate response schema and values
        assert join_data.get("success") is True, f"Expected success True, got {join_data.get('success')}"
        assert "village_id" in join_data, "village_id missing in response"
        assert join_data["village_id"] == 1, f"Expected village_id 1, got {join_data['village_id']}"
        assert "village_name" in join_data, "village_name missing in response"
        assert isinstance(join_data["village_name"], str) and len(join_data["village_name"]) > 0, "Invalid village_name"
    except Exception as e:
        raise RuntimeError(f"svc_join_village call failed or assertions failed: {e}")

test_join_village_with_valid_code_authenticated()