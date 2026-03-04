"""Structured logging setup for FarmCast."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any


# =====================================================
# CONSOLE FORMAT (CLEAN PROFESSIONAL STYLE)
# =====================================================
FORMAT = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


# =====================================================
# JSON FORMATTER (FOR FILE LOGS)
# =====================================================
class JsonMessageFormatter(logging.Formatter):
    """Serialize log records as compact JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "stage"):
            payload["stage"] = record.stage
        if hasattr(record, "event"):
            payload["event"] = record.event
        if hasattr(record, "fields"):
            payload["fields"] = record.fields
        return json.dumps(payload, separators=(",", ":"))


# =====================================================
# LOGGER FACTORY
# =====================================================
def get_logger(name: str = "farmcast", log_file: str | Path = "logs/farmcast_ml.log") -> logging.Logger:
    logger = logging.getLogger(name)

    # Prevent duplicate handlers
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)

    # -------------------------------------------------
    # CONSOLE HANDLER (CLEAN FORMAT)
    # -------------------------------------------------
    console_formatter = logging.Formatter(FORMAT, datefmt=DATE_FORMAT)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(console_formatter)
    logger.addHandler(stream_handler)

    # -------------------------------------------------
    # FILE HANDLER (JSON STRUCTURED)
    # -------------------------------------------------
    path = Path(log_file)
    path.parent.mkdir(parents=True, exist_ok=True)

    file_handler = logging.FileHandler(path, encoding="utf-8")
    file_handler.setFormatter(JsonMessageFormatter())
    logger.addHandler(file_handler)

    logger.propagate = False
    return logger


# =====================================================
# STRUCTURED EVENT LOGGING
# =====================================================
def log_event(logger: logging.Logger, stage: str, event: str, **fields: Any) -> None:
    logger.info(event, extra={"stage": stage, "event": event, "fields": fields})
