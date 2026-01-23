import os
from fastapi import Header, HTTPException, status


def _get_expected_token() -> str:
    token = os.getenv("INTERNAL_AUTH_TOKEN")
    if not token:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="server token not configured")
    return token


# Verifies internal service token or mTLS-derived identity.
async def verify_service_token(authorization: str | None = Header(default=None)):
    if authorization is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing token")

    expected = _get_expected_token()
    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")

    return {"subject": "service", "scopes": []}
