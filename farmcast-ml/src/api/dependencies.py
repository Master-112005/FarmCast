"""API dependency providers."""

from __future__ import annotations

import os
import re
from functools import lru_cache
from pathlib import Path

from fastapi import Request

from src.api.auth import verify_api_key
from src.core.config import ConfigLoader
from src.pipelines.inference_pipeline import InferencePipeline


@lru_cache(maxsize=1)
def get_app_config() -> dict:
    loader = ConfigLoader()
    return loader.load_app_config("configs/app_config.yaml")


@lru_cache(maxsize=1)
def get_inference_pipeline() -> InferencePipeline:
    return InferencePipeline(app_config_path="configs/app_config.yaml")


@lru_cache(maxsize=1)
def load_local_env_file() -> None:
    root = Path(__file__).resolve().parents[2]
    env_path = root / ".env"
    if not env_path.exists():
        return

    content = env_path.read_text(encoding="utf-8")
    for raw in content.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue
        cleaned = value.strip().strip('"').strip("'")
        os.environ[key] = cleaned


def _extract_bearer_token(value: str | None) -> str | None:
    if not value:
        return None
    token = value.strip()
    if not token:
        return None
    if token.lower().startswith("bearer "):
        return token[7:].strip() or None
    return None


def _extract_first_key(raw: str | None) -> str | None:
    if not raw:
        return None
    for entry in re.split(r"[,\s;]+", raw):
        token = entry.strip()
        if not token:
            continue
        if ":" in token:
            _, token = token.split(":", 1)
            token = token.strip()
        if token:
            return token
    return None


def _resolve_expected_api_key(config: dict) -> str | None:
    configured_env = str(config["api"].get("api_key_env", "FARMCAST_API_KEY"))
    expected = os.getenv(configured_env) or os.getenv("FARMCAST_API_KEY")
    if expected:
        return expected
    return _extract_first_key(os.getenv("ML_API_KEYS"))


def api_key_guard(request: Request) -> None:
    load_local_env_file()
    config = get_app_config()
    header_name = str(config["api"].get("api_key_header", "X-API-Key"))
    received = request.headers.get(header_name) or request.headers.get("x-api-key")
    if not received:
        received = _extract_bearer_token(request.headers.get("authorization"))

    expected = _resolve_expected_api_key(config)
    verify_api_key(received=received, expected=expected)
