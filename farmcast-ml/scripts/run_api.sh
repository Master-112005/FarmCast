#!/usr/bin/env bash
set -euo pipefail

ML_HOST="${ML_HOST:-0.0.0.0}"
ML_PORT="${ML_PORT:-5001}"

uvicorn src.api.ml_service:app --host "${ML_HOST}" --port "${ML_PORT}"
