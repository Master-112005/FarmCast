"""Runtime artifact inventory and validation."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import pandas as pd

from src.core.observability import log_event, monotonic


logger = logging.getLogger("farmcast.ml.artifacts")
PROJECT_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class ArtifactSpec:
    key: str
    relative_path: str
    required: bool
    endpoints: tuple[str, ...]
    startup_critical: bool = False
    validator: Callable[[Path], dict[str, object]] | None = None

    @property
    def path(self) -> Path:
        return PROJECT_ROOT / self.relative_path


def _readable_file(path: Path) -> dict[str, object]:
    with path.open("rb") as file_obj:
        file_obj.read(1)
    return {"size_bytes": path.stat().st_size}


def _weather_schema(path: Path) -> dict[str, object]:
    frame = pd.read_parquet(path)
    required_columns = {
        "state",
        "district",
        "season",
        "year",
        "rainfall_total",
        "avg_temp",
        "avg_humidity",
    }
    missing = sorted(required_columns.difference(frame.columns))
    if missing:
        raise ValueError(f"weather artifact missing columns: {missing}")
    return {
        "size_bytes": path.stat().st_size,
        "rows": int(len(frame)),
        "columns": list(frame.columns),
    }


RUNTIME_ARTIFACTS: tuple[ArtifactSpec, ...] = (
    ArtifactSpec(
        key="app_config",
        relative_path="configs/app_config.yaml",
        required=True,
        startup_critical=True,
        endpoints=("startup", "all"),
        validator=_readable_file,
    ),
    ArtifactSpec(
        key="disease_model",
        relative_path="models/disease/production/model.keras",
        required=True,
        startup_critical=True,
        endpoints=("/predict/disease",),
        validator=_readable_file,
    ),
    ArtifactSpec(
        key="disease_class_map",
        relative_path="models/disease/production/class_map.json",
        required=True,
        startup_critical=True,
        endpoints=("/predict/disease",),
        validator=_readable_file,
    ),
    ArtifactSpec(
        key="disease_metadata",
        relative_path="models/disease/production/metadata.json",
        required=True,
        startup_critical=True,
        endpoints=("/predict/disease",),
        validator=_readable_file,
    ),
    ArtifactSpec(
        key="legacy_yield_model",
        relative_path="models/yield/v2/model.pkl",
        required=True,
        endpoints=("/predict/yield",),
        validator=_readable_file,
    ),
    ArtifactSpec(
        key="legacy_yield_metadata",
        relative_path="models/yield/v2/metadata.json",
        required=True,
        endpoints=("/predict/yield",),
        validator=_readable_file,
    ),
    ArtifactSpec(
        key="weather_aggregated",
        relative_path="data/processed/weather_aggregated.parquet",
        required=True,
        endpoints=("/predict/yield",),
        validator=_weather_schema,
    ),
    ArtifactSpec(
        key="pipeline_yield_model",
        relative_path="models/yield/production/model.joblib",
        required=False,
        endpoints=("/predict/yield",),
        validator=_readable_file,
    ),
    ArtifactSpec(
        key="pipeline_yield_preprocessor",
        relative_path="models/yield/production/preprocessor.joblib",
        required=False,
        endpoints=("/predict/yield",),
        validator=_readable_file,
    ),
    ArtifactSpec(
        key="pipeline_yield_metadata",
        relative_path="models/yield/production/metadata.json",
        required=False,
        endpoints=("/predict/yield",),
        validator=_readable_file,
    ),
    ArtifactSpec(
        key="price_model",
        relative_path="models/price/production/model.joblib",
        required=False,
        endpoints=("/predict/price",),
        validator=_readable_file,
    ),
    ArtifactSpec(
        key="price_preprocessor",
        relative_path="models/price/production/preprocessor.joblib",
        required=False,
        endpoints=("/predict/price",),
        validator=_readable_file,
    ),
    ArtifactSpec(
        key="price_metadata",
        relative_path="models/price/production/metadata.json",
        required=False,
        endpoints=("/predict/price",),
        validator=_readable_file,
    ),
)


def _validate(spec: ArtifactSpec) -> dict[str, object]:
    path = spec.path
    payload: dict[str, object] = {
        "artifact_key": spec.key,
        "artifact_path": str(path),
        "relative_path": spec.relative_path,
        "required": spec.required,
        "startup_critical": spec.startup_critical,
        "endpoints": list(spec.endpoints),
        "exists": path.exists(),
    }
    if not path.exists():
        return payload
    if not path.is_file():
        raise ValueError(f"artifact is not a file: {path}")
    validator = spec.validator or _readable_file
    payload.update(validator(path))
    return payload


def validate_artifacts(*, startup_only: bool = False, endpoint: str | None = None) -> list[dict[str, object]]:
    validation_start = monotonic()
    results: list[dict[str, object]] = []
    missing_required: list[dict[str, object]] = []
    failed: list[dict[str, object]] = []

    for spec in RUNTIME_ARTIFACTS:
        if startup_only and not spec.startup_critical:
            continue
        if endpoint and endpoint not in spec.endpoints and "all" not in spec.endpoints:
            continue
        try:
            result = _validate(spec)
            results.append(result)
            severity = "info"
            event = "artifact_validated" if result["exists"] else "artifact_missing_optional"
            if not result["exists"] and spec.required:
                event = "artifact_missing_required"
                severity = "error"
                missing_required.append(result)
            log_event(logger, event, severity=severity, stage="artifact_validation", **result)
        except Exception as exc:
            result = {
                "artifact_key": spec.key,
                "artifact_path": str(spec.path),
                "relative_path": spec.relative_path,
                "required": spec.required,
                "startup_critical": spec.startup_critical,
                "endpoints": list(spec.endpoints),
            }
            failed.append(result)
            if spec.required:
                missing_required.append(result)
            log_event(
                logger,
                "artifact_validation_failed",
                severity="error" if spec.required else "warning",
                start=validation_start,
                stage="artifact_validation",
                exc=exc,
                **result,
            )

    log_event(
        logger,
        "artifact_inventory_complete",
        start=validation_start,
        stage="artifact_validation",
        startup_only=startup_only,
        endpoint=endpoint,
        artifact_count=len(results),
        missing_required_count=len(missing_required),
        failed_count=len(failed),
    )
    if missing_required:
        names = ", ".join(str(item["artifact_key"]) for item in missing_required)
        raise FileNotFoundError(f"Missing required runtime artifacts: {names}")
    return results
