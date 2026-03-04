"""Disease model utilities."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np


def compute_class_weights(labels: list[int], class_count: int) -> list[float]:
    counts = np.bincount(np.asarray(labels, dtype=np.int64), minlength=class_count).astype(np.float64)
    total = float(np.sum(counts))
    weights = []
    for count in counts:
        if count <= 0:
            weights.append(1.0)
        else:
            weights.append(total / (class_count * float(count)))
    return weights


def parse_class_label(class_name: str) -> tuple[str, str]:
    if "__" not in class_name:
        return "unknown", class_name
    crop, disease = class_name.split("__", 1)
    return crop, disease


def save_class_map(path: str | Path, class_map: dict[str, int]) -> Path:
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(class_map, indent=2), encoding="utf-8")
    return output


def load_class_map(path: str | Path) -> dict[str, int]:
    input_path = Path(path)
    return json.loads(input_path.read_text(encoding="utf-8"))
