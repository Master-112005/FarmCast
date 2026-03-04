"""Registry metadata models and validation."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

from src.core.exceptions import RegistryError, SchemaValidationError


@dataclass(frozen=True)
class ModelMetadata:
    model_name: str
    version: str
    timestamp_utc: str
    dataset_hash: str
    metrics: dict[str, float]
    config_snapshot: dict[str, Any]
    latency_benchmark_ms: float
    artifact_path: str
    stage: str

    @staticmethod
    def now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def load_registry_schema(path: str | Path) -> dict[str, Any]:
    schema_path = Path(path)
    if not schema_path.exists():
        raise SchemaValidationError(f"Registry schema file not found: {schema_path}")
    schema = yaml.safe_load(schema_path.read_text(encoding="utf-8"))
    if not isinstance(schema, dict):
        raise SchemaValidationError("Registry schema must be a mapping.")
    return schema


def validate_metadata(metadata: dict[str, Any], schema: dict[str, Any]) -> None:
    required = schema.get("required")
    if not isinstance(required, list):
        raise SchemaValidationError("Registry schema 'required' must be list[str].")

    missing = [field for field in required if field not in metadata]
    if missing:
        raise RegistryError(f"Metadata missing required fields: {missing}")

    properties = schema.get("properties", {})
    if not isinstance(properties, dict):
        raise SchemaValidationError("Registry schema 'properties' must be mapping.")

    type_map = {
        "string": str,
        "number": (int, float),
        "object": dict,
    }
    for field, spec in properties.items():
        if field not in metadata:
            continue
        if not isinstance(spec, dict):
            raise SchemaValidationError(f"Registry property '{field}' spec must be mapping.")
        expected_type = spec.get("type")
        if expected_type not in type_map:
            continue
        if not isinstance(metadata[field], type_map[expected_type]):
            raise RegistryError(f"Metadata field '{field}' expected type {expected_type}.")
