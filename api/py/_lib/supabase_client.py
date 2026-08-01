"""
GramSeva — Supabase Admin Client for Python Serverless Functions
Uses service_role key to bypass RLS for server-side operations.
"""

import os
from supabase import create_client, Client

_supabase_admin: Client | None = None


def get_supabase_admin() -> Client:
    """
    Get or create a Supabase admin client using service_role key.
    Raises RuntimeError if required env vars are missing.
    """
    global _supabase_admin
    if _supabase_admin is not None:
        return _supabase_admin

    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        missing = []
        if not url:
            missing.append("SUPABASE_URL")
        if not key:
            missing.append("SUPABASE_SERVICE_ROLE_KEY")
        raise RuntimeError(f"Missing environment variables: {', '.join(missing)}")

    _supabase_admin = create_client(url, key)
    return _supabase_admin


def get_supabase_url() -> str:
    """Get Supabase project URL."""
    return os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL", "")
