# FarmCast ML

modular ML platform for disease detection, yield prediction, and price forecasting.

## Core Guarantees

- Deterministic training seed control (`PYTHONHASHSEED`, `random`, `numpy`, `tensorflow`, LightGBM seed)
- Config-driven orchestration with fail-fast validation
- Strict schema checks before any training
- Separate ingestion, features, model, registry, monitoring, and API layers
- Safe promotion (candidate promoted only if objective metrics improve)

## Entry Points

- Train: `python -m src.pipelines.training_pipeline --task all --config configs/training_config.yaml`
- Retrain: `python -m src.pipelines.retraining_pipeline --task all --training-config configs/training_config.yaml --retraining-config configs/retraining_config.yaml`
- API: `uvicorn src.api.ml_service:app --host 0.0.0.0 --port 8000`

## Tasks

- `yield`: LightGBM regression with time-aware split
- `price`: LightGBM regression with sequential validation and lag features
- `disease`: MobileNetV3 image classification with class/corruption safety checks

## Tests

- Run: `python -m pytest -q`
