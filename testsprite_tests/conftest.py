import os
import pytest

@pytest.fixture(scope="session")
def base_url():
    aux = os.environ.get("SUPABASE_AUX_URL", "").rstrip("/")
    return f"{aux}/rest/v1" if aux else os.environ.get("TEST_BASE_URL", "http://localhost:54321/rest/v1")

@pytest.fixture(scope="session")
def api_key():
    return os.environ.get("VITE_SUPABASE_AUX_ANON_KEY") or os.environ.get("SUPABASE_AUX_ANON_KEY") or os.environ.get("TEST_API_KEY", "")

@pytest.fixture(scope="session")
def auth_url():
    aux = os.environ.get("SUPABASE_AUX_URL", "").rstrip("/")
    return f"{aux}/auth/v1" if aux else os.environ.get("TEST_AUTH_URL", "http://localhost:54321/auth/v1")
