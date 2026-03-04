"""Model registry persistence and promotion state."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.core.exceptions import RegistryError
from src.registry.metadata_manager import load_registry_schema, validate_metadata
from src.registry.promotion import is_better, resolve_objectives


class ModelRegistry:
    def __init__(self, registry_path: str | Path, schema_path: str | Path, config: dict[str, Any]) -> None:
        self.registry_path = Path(registry_path)
        self.schema = load_registry_schema(schema_path)
        self.config = config
        self._data = self._load()

    def _initial_state(self) -> dict[str, list[dict[str, Any]]]:
        return {"disease": [], "yield": [], "price": []}

    def _load(self) -> dict[str, list[dict[str, Any]]]:
        if not self.registry_path.exists():
            self.registry_path.parent.mkdir(parents=True, exist_ok=True)
            initial = self._initial_state()
            self.registry_path.write_text(json.dumps(initial, indent=2), encoding="utf-8")
            return initial

        content = self.registry_path.read_text(encoding="utf-8").strip()
        if not content:
            return self._initial_state()
        raw = json.loads(content)
        if not isinstance(raw, dict):
            raise RegistryError("Registry JSON root must be object.")
        state = self._initial_state()
        for task in state:
            entries = raw.get(task, [])
            if not isinstance(entries, list):
                raise RegistryError(f"Registry field '{task}' must be list.")
            state[task] = entries
        return state

    def save(self) -> None:
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)
        self.registry_path.write_text(json.dumps(self._data, indent=2), encoding="utf-8")

    def list_entries(self, task: str) -> list[dict[str, Any]]:
        if task not in self._data:
            raise RegistryError(f"Unknown task '{task}'.")
        return list(self._data[task])

    def latest(self, task: str, stage: str | None = None) -> dict[str, Any] | None:
        entries = self.list_entries(task)
        if stage:
            entries = [entry for entry in entries if entry.get("stage") == stage]
        if not entries:
            return None
        return sorted(entries, key=lambda item: item["timestamp_utc"])[-1]

    def _next_version(self, task: str) -> str:
        prefix = self.config["registry"]["version_prefix"][task]
        entries = self.list_entries(task)
        if not entries:
            return f"{prefix}1.0.0"
        last = sorted(entries, key=lambda item: item["timestamp_utc"])[-1]["version"]
        try:
            version = last.split("v", 1)[1]
            major, minor, patch = version.split(".")
            return f"{prefix}{major}.{minor}.{int(patch) + 1}"
        except Exception as exc:
            raise RegistryError(f"Invalid existing version format: {last}") from exc

    def next_version(self, task: str) -> str:
        return self._next_version(task)

    def register_candidate(self, task: str, metadata: dict[str, Any]) -> dict[str, Any]:
        validate_metadata(metadata, self.schema)
        if metadata.get("model_name") != task:
            raise RegistryError(f"Metadata model_name '{metadata.get('model_name')}' does not match task '{task}'.")

        candidate = dict(metadata)
        if "version" not in candidate or not candidate["version"]:
            candidate["version"] = self._next_version(task)
        if "stage" not in candidate or candidate["stage"] not in {"staging", "production"}:
            candidate["stage"] = "staging"
        self._data[task].append(candidate)
        self.save()
        return candidate

    def should_promote(self, task: str, candidate_metrics: dict[str, float]) -> bool:
        production_entry = self.latest(task, stage="production")
        if production_entry is None:
            return True
        objectives = resolve_objectives(self.config, task)
        return is_better(candidate_metrics, production_entry["metrics"], objectives)

    def promote(self, task: str, version: str) -> dict[str, Any]:
        entries = self._data.get(task)
        if entries is None:
            raise RegistryError(f"Unknown task '{task}'.")
        target = None
        for entry in entries:
            if entry["version"] == version:
                target = entry
            if entry.get("stage") == "production":
                entry["stage"] = "archived"
        if target is None:
            raise RegistryError(f"Version '{version}' not found for task '{task}'.")
        target["stage"] = "production"
        self.save()
        return target

    def get_production(self, task: str) -> dict[str, Any] | None:
        return self.latest(task, stage="production")
