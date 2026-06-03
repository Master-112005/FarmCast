"""Lightweight production observability helpers."""

from __future__ import annotations

import json
import logging
import os
import platform
import time
import traceback
from datetime import datetime, timezone
from typing import Any

try:
    import resource
except ImportError:
    resource = None


PROCESS_START_TIME = time.monotonic()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def elapsed_ms(start: float | None = None) -> int:
    origin = PROCESS_START_TIME if start is None else start
    return int((time.monotonic() - origin) * 1000)


def monotonic() -> float:
    return time.monotonic()


def memory_usage() -> dict[str, int | None]:
    rss_kb: int | None = None
    try:
        if resource is not None:
            rss_kb = int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
            if platform.system() == "Darwin":
                rss_kb = rss_kb // 1024
    except Exception:
        rss_kb = None

    current_rss_kb: int | None = None
    try:
        with open("/proc/self/status", "r", encoding="utf-8") as status_file:
            for line in status_file:
                if line.startswith("VmRSS:"):
                    current_rss_kb = int(line.split()[1])
                    break
    except Exception:
        current_rss_kb = None

    return {
        "rss_kb": current_rss_kb or rss_kb,
        "max_rss_kb": rss_kb,
    }


def memory_delta(previous: dict[str, int | None] | None) -> dict[str, int | None]:
    current = memory_usage()
    previous_rss = previous.get("rss_kb") if previous else None
    current_rss = current.get("rss_kb")
    delta = current_rss - previous_rss if current_rss is not None and previous_rss is not None else None
    return {
        "rss_kb": current_rss,
        "max_rss_kb": current.get("max_rss_kb"),
        "previous_rss_kb": previous_rss,
        "rss_delta_kb": delta,
    }


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": now_iso(),
            "severity": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        fields = getattr(record, "fields", None)
        if isinstance(fields, dict):
            payload.update(fields)
        if record.exc_info:
            payload["stack"] = self.formatException(record.exc_info)
        return json.dumps(payload, separators=(",", ":"), default=str)


def configure_json_logging(level: str | None = None) -> None:
    resolved_level = getattr(logging, (level or os.getenv("LOG_LEVEL", "INFO")).upper(), logging.INFO)
    root = logging.getLogger()
    root.setLevel(resolved_level)

    if not root.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        root.addHandler(handler)
        return

    for handler in root.handlers:
        handler.setFormatter(JsonFormatter())
        handler.setLevel(resolved_level)


def log_event(
    logger: logging.Logger,
    event: str,
    *,
    severity: str = "info",
    start: float | None = None,
    exc: BaseException | None = None,
    **fields: Any,
) -> None:
    payload = {
        "event": event,
        "elapsed_ms": elapsed_ms(start),
        "memory": memory_usage(),
        **fields,
    }
    level = getattr(logging, severity.upper(), logging.INFO)
    if exc is not None:
        payload["error_type"] = type(exc).__name__
        payload["error"] = str(exc)
        payload["stack"] = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    logger.log(level, event, extra={"fields": payload}, exc_info=exc if exc is not None else None)
