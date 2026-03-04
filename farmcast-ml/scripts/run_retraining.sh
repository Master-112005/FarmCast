#!/usr/bin/env bash
set -euo pipefail

python -m src.pipelines.retraining_pipeline \
  --task "${1:-all}" \
  --training-config configs/training_config.yaml \
  --retraining-config configs/retraining_config.yaml
