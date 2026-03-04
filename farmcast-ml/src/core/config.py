"""Configuration loading and validation utilities."""

from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

import yaml

from src.core.exceptions import ConfigError


def _require_mapping(value: Any, context: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ConfigError(f"{context} must be a mapping, got {type(value).__name__}")
    return value


def require_keys(config: dict[str, Any], keys: list[str], context: str) -> None:
    missing = [key for key in keys if key not in config]
    if missing:
        raise ConfigError(f"{context} missing required keys: {missing}")


class ConfigLoader:
    """Strict config loader with fail-fast validation."""

    def __init__(self, project_root: str | Path | None = None) -> None:
        self.project_root = Path(project_root) if project_root else Path.cwd()

    def resolve(self, path: str | Path) -> Path:
        path_obj = Path(path)
        return path_obj if path_obj.is_absolute() else (self.project_root / path_obj)

    def load_yaml(self, path: str | Path) -> dict[str, Any]:
        resolved = self.resolve(path)
        if not resolved.exists():
            raise ConfigError(f"Config not found: {resolved}")
        content = resolved.read_text(encoding="utf-8")
        data = yaml.safe_load(content)
        if data is None:
            raise ConfigError(f"Config is empty: {resolved}")
        return _require_mapping(data, f"Config {resolved}")

    def load_training_config(self, path: str | Path = "configs/training_config.yaml") -> dict[str, Any]:
        config = self.load_yaml(path)
        require_keys(config, ["runtime", "paths", "disease", "yield", "price", "registry"], "training_config")
        return config

    def load_app_config(self, path: str | Path = "configs/app_config.yaml") -> dict[str, Any]:
        config = self.load_yaml(path)
        require_keys(config, ["api", "inference"], "app_config")
        return config

    def load_monitoring_config(self, path: str | Path = "configs/monitoring_config.yaml") -> dict[str, Any]:
        config = self.load_yaml(path)
        require_keys(config, ["monitoring"], "monitoring_config")
        return config

    def load_retraining_config(self, path: str | Path = "configs/retraining_config.yaml") -> dict[str, Any]:
        config = self.load_yaml(path)
        require_keys(config, ["retraining"], "retraining_config")
        return config

    def snapshot(self, config: dict[str, Any]) -> dict[str, Any]:
        return copy.deepcopy(config)
