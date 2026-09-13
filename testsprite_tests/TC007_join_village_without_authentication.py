import os
import requests

def test_join_village_without_authentication():
    BASE_URL = os.environ.get("SUPABASE_AUX_URL", "http://localhost:54321").rstrip("/") + "/rest/v1"
    endpoint = f"{base_url}/rpc/svc_join_village"
    headers = {
        "apikey": (os.environ.get("VITE_SUPABASE_AUX_ANON_KEY") or os.environ.get("SUPABASE_AUX_ANON_KEY", "")),
        "Content-Type": "application/json"
    }
    payload = {
        "p_code": "GSV12345"
    }

    try:
        response = requests.post(endpoint, json=payload, headers=headers, timeout=30)
        # Assert status code is 200
        assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
        data = response.json()
        # Assert response contains success == False and error == "Not authenticated"
        assert "success" in data, "Response JSON missing 'success' field"
        assert data["success"] is False, f"Expected success False, got {data['success']}"
        assert "error" in data, "Response JSON missing 'error' field"
        assert data["error"] == "Not authenticated", f"Expected error 'Not authenticated', got {data['error']}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_join_village_without_authentication()
