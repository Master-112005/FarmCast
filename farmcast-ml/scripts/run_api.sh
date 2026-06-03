#!/usr/bin/env bash
set -euo pipefail

ML_HOST="${ML_HOST:-0.0.0.0}"
ML_PORT="${PORT:-${ML_PORT:-5001}}"

export TF_CPP_MIN_LOG_LEVEL="${TF_CPP_MIN_LOG_LEVEL:-2}"
export TF_ENABLE_ONEDNN_OPTS="${TF_ENABLE_ONEDNN_OPTS:-0}"
export TF_NUM_INTRAOP_THREADS="${TF_NUM_INTRAOP_THREADS:-1}"
export TF_NUM_INTEROP_THREADS="${TF_NUM_INTEROP_THREADS:-1}"
export OMP_NUM_THREADS="${OMP_NUM_THREADS:-1}"
export OPENBLAS_NUM_THREADS="${OPENBLAS_NUM_THREADS:-1}"
export MKL_NUM_THREADS="${MKL_NUM_THREADS:-1}"
export MALLOC_ARENA_MAX="${MALLOC_ARENA_MAX:-2}"
export PYTHONMALLOC="${PYTHONMALLOC:-malloc}"

uvicorn src.api.ml_service:app --host "${ML_HOST}" --port "${ML_PORT}" --timeout-keep-alive 5 --access-log
