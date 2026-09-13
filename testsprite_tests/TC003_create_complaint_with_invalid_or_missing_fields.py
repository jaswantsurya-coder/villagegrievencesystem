import os
import requests
import random

BASE_URL = os.environ.get("SUPABASE_AUX_URL", "http://localhost:54321").rstrip("/") + "/rest/v1"
API_KEY = os.environ.get("VITE_SUPABASE_AUX_ANON_KEY") or os.environ.get("SUPABASE_AUX_ANON_KEY", "")
HEADERS_NO_AUTH = {
    "apikey": API_KEY,
    "Content-Type": "application/json"
}

def test_create_complaint_with_invalid_or_missing_fields():
    url = f"{BASE_URL}/rpc/svc_create_complaint"

    # Define test payloads with invalid or missing required fields (title, category, location).
    test_payloads = [
        {   # Missing title
            "p_title": None,
            "p_description": "Description with missing title",
            "p_category": "Garbage",
            "p_location": "Near park",
            "p_latitude": 12.9716,
            "p_longitude": 77.5946,
            "p_photos": [],
            "p_photo_urls": [],
            "p_related_scheme": "CleanCity",
            "p_is_anonymous": False,
            "p_anonymous_phone": None,
            "p_village_id": 1
        },
        {   # Empty title string
            "p_title": "",
            "p_description": "Description with empty title",
            "p_category": "Road",
            "p_location": "Main street",
            "p_latitude": 12.9716,
            "p_longitude": 77.5946,
            "p_photos": [],
            "p_photo_urls": [],
            "p_related_scheme": "RoadFix",
            "p_is_anonymous": False,
            "p_anonymous_phone": None,
            "p_village_id": 1
        },
        {   # Missing category
            "p_title": "Pothole issue",
            "p_description": "Description with missing category",
            "p_category": None,
            "p_location": "Market road",
            "p_latitude": 12.9716,
            "p_longitude": 77.5946,
            "p_photos": [],
            "p_photo_urls": [],
            "p_related_scheme": "RoadFix",
            "p_is_anonymous": False,
            "p_anonymous_phone": None,
            "p_village_id": 1
        },
        {   # Empty category string
            "p_title": "Leakage",
            "p_description": "Description with empty category",
            "p_category": "",
            "p_location": "River side",
            "p_latitude": 12.9716,
            "p_longitude": 77.5946,
            "p_photos": [],
            "p_photo_urls": [],
            "p_related_scheme": "WaterWorks",
            "p_is_anonymous": False,
            "p_anonymous_phone": None,
            "p_village_id": 1
        },
        {   # Missing location
            "p_title": "Street Light Broken",
            "p_description": "Description missing location",
            "p_category": "Electricity",
            "p_location": None,
            "p_latitude": 12.9716,
            "p_longitude": 77.5946,
            "p_photos": [],
            "p_photo_urls": [],
            "p_related_scheme": "PowerGrid",
            "p_is_anonymous": False,
            "p_anonymous_phone": None,
            "p_village_id": 1
        },
        {   # Empty location string
            "p_title": "Garbage overflow",
            "p_description": "Description with empty location",
            "p_category": "Garbage",
            "p_location": "",
            "p_latitude": 12.9716,
            "p_longitude": 77.5946,
            "p_photos": [],
            "p_photo_urls": [],
            "p_related_scheme": "CleanCity",
            "p_is_anonymous": False,
            "p_anonymous_phone": None,
            "p_village_id": 1
        }
    ]

    for payload in test_payloads:
        try:
            response = requests.post(url, json=payload, headers=HEADERS_NO_AUTH, timeout=30)
        except requests.RequestException as e:
            assert False, f"Request failed: {e}"

        assert response.status_code == 200, f"Expected HTTP 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, dict), "Response is not a JSON object"
        assert data.get("success") is False, f"Expected success False for payload: {payload}"
        # The error message should be present and non-empty string
        assert "error" in data, f"Expected 'error' key in response for payload: {payload}"
        assert isinstance(data["error"], str) and data["error"].strip() != "", f"Expected non-empty error message for payload: {payload}"
        # complaint_id and ticket_id should not be present or None/empty since creation failed
        assert not data.get("complaint_id"), f"Expected no complaint_id for failed creation with payload: {payload}"
        assert not data.get("ticket_id"), f"Expected no ticket_id for failed creation with payload: {payload}"

test_create_complaint_with_invalid_or_missing_fields()
