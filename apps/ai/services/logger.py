from __future__ import annotations

import hashlib
import os
from datetime import datetime
from typing import Optional

_LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
_LOG_PATH = os.path.join(_LOG_DIR, 'openrouter.log')

os.makedirs(_LOG_DIR, exist_ok=True)


def _timestamp() -> str:
    return datetime.utcnow().isoformat(timespec='seconds') + 'Z'


def _hash_secret(value: str) -> str:
    try:
        return hashlib.sha256(value.encode('utf-8')).hexdigest()
    except Exception:
        return 'hash-error'


def log_openrouter_key(api_key: Optional[str], context: str = 'init') -> None:
    """Writes a masked/hashed record that the OpenRouter key is configured.

    We never log the raw key. Instead we include a SHA-256 hash to aid ops
    without leaking secrets.
    """
    status = 'missing' if not api_key else 'present'
    hash_val = _hash_secret(api_key or '') if api_key else 'n/a'
    line = f"[{_timestamp()}] context={context} status={status} sha256={hash_val}\n"
    try:
        with open(_LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(line)
    except Exception:
        # Swallow logging errors to avoid breaking runtime
        pass


def log_openrouter_event(event: str, detail: str) -> None:
    line = f"[{_timestamp()}] event={event} detail={detail}\n"
    try:
        with open(_LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(line)
    except Exception:
        pass
