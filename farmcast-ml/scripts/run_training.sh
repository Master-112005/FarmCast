#!/usr/bin/env bash
set -euo pipefail

python -m src.pipelines.training_pipeline --task "${1:-all}" --config configs/training_config.yaml
