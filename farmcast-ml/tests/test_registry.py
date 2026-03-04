from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from src.core.config import ConfigLoader
from src.registry.model_registry import ModelRegistry
from src.registry.promotion import is_better


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _candidate(task: str, version: str, metrics: dict[str, float], artifact_path: str) -> dict:
    return {
        "model_name": task,
        "version": version,
        "timestamp_utc": _iso(),
        "dataset_hash": "abc123",
        "metrics": metrics,
        "config_snapshot": {"any": "value"},
        "latency_benchmark_ms": 10.0,
        "artifact_path": artifact_path,
        "stage": "staging",
    }


def test_is_better_objective_logic() -> None:
    objectives = {"r2": "max", "mae": "min"}
    assert is_better({"r2": 0.9, "mae": 7.0}, {"r2": 0.88, "mae": 7.2}, objectives)
    assert not is_better({"r2": 0.87, "mae": 7.0}, {"r2": 0.88, "mae": 7.2}, objectives)


def test_registry_register_and_promote(tmp_path: Path) -> None:
    config = ConfigLoader().load_training_config("configs/training_config.yaml")
    registry = ModelRegistry(
        registry_path=tmp_path / "registry.json",
        schema_path="configs/schemas/registry_schema.yaml",
        config=config,
    )

    first = registry.register_candidate(
        "yield",
        _candidate("yield", "yield_v1.0.0", {"r2": 0.9, "mae": 7.0}, artifact_path="models/yield/staging/yield_v1.0.0"),
    )
    assert registry.should_promote("yield", first["metrics"])
    registry.promote("yield", first["version"])
    assert registry.get_production("yield")["version"] == "yield_v1.0.0"

    second = registry.register_candidate(
        "yield",
        _candidate("yield", "yield_v1.0.1", {"r2": 0.8, "mae": 8.2}, artifact_path="models/yield/staging/yield_v1.0.1"),
    )
    assert not registry.should_promote("yield", second["metrics"])
