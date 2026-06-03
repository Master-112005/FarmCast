from __future__ import annotations

from pathlib import Path

from src.core.artifacts import RUNTIME_ARTIFACTS, validate_artifacts


def test_required_runtime_artifacts_exist_and_validate() -> None:
    results = validate_artifacts()
    by_key = {item["artifact_key"]: item for item in results}

    required_keys = {
        spec.key
        for spec in RUNTIME_ARTIFACTS
        if spec.required
    }

    assert required_keys.issubset(by_key)
    assert all(by_key[key]["exists"] for key in required_keys)
    assert by_key["weather_aggregated"]["rows"] > 0


def test_packaging_rules_include_weather_runtime_artifact() -> None:
    root = Path(__file__).resolve().parents[1]
    dockerfile = root / "Dockerfile"
    dockerignore = root / ".dockerignore"

    assert "COPY data/processed/weather_aggregated.parquet" in dockerfile.read_text(
        encoding="utf-8"
    )
    assert "!data/processed/weather_aggregated.parquet" in dockerignore.read_text(
        encoding="utf-8"
    )
