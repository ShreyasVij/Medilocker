from __future__ import annotations

import os
from typing import Optional
from supabase import create_client, Client

_client: Optional[Client] = None


def _get_client() -> Client:
    global _client
    if _client is not None:
        return _client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_KEY missing for AI service")
    _client = create_client(url, key)
    return _client


def create_signed_url(storage_key: str, *, expires_in: int = 300, bucket: Optional[str] = None) -> str:
    bucket_name = bucket or os.getenv("SUPABASE_BUCKET", "medilocker")
    client = _get_client()
    res = client.storage.from_(bucket_name).create_signed_url(storage_key, expires_in)
    # supabase-py returns dict with signedURL or signed_url depending on version
    url = res.get("signedURL") or res.get("signed_url") or res.get("signedUrl")
    if not url:
        raise RuntimeError("Failed to create signed URL from Supabase")
    # Some SDKs return path without absolute URL; ensure absolute
    if url.startswith("http"):
        return url
    base = os.getenv("SUPABASE_URL").rstrip("/")
    return f"{base}{url}"
# Storage service for fetching objects via signed URLs or SDK.
async def fetch_object(storage_key: str):
  return None
