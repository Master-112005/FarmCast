"""Pipeline helpers."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from time import perf_counter
from typing import Any, Callable


def ensure_dir(path: str | Path) -> Path:
    output = Path(path)
    output.mkdir(parents=True, exist_ok=True)
    return output


def write_json(path: str | Path, payload: dict[str, Any]) -> Path:
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return output


def read_json(path: str | Path) -> dict[str, Any]:
    input_path = Path(path)
    return json.loads(input_path.read_text(encoding="utf-8"))


def benchmark_latency(callable_fn: Callable[[], Any], iterations: int) -> float:
    start = perf_counter()
    for _ in range(iterations):
        callable_fn()
    elapsed = perf_counter() - start
    return float((elapsed / max(iterations, 1)) * 1000.0)


def promote_artifact(src: str | Path, dest: str | Path) -> Path:
    src_path = Path(src)
    dest_path = Path(dest)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src_path, dest_path)
    return dest_path
