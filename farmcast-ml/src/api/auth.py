"""API key authentication."""

from __future__ import annotations

from fastapi import HTTPException, status


def verify_api_key(received: str | None, expected: str | None) -> None:
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="API key is not configured on server.",
        )
    if not received or received != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key.",
        )
