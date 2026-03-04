"""Yield model evaluation."""

from __future__ import annotations

import numpy as np

from src.core.exceptions import TrainingAbortError
from src.core.metrics import regression_metrics


def evaluate_yield_model(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    return regression_metrics(y_true, y_pred)


def enforce_yield_thresholds(metrics: dict[str, float], thresholds: dict[str, float]) -> None:
    if metrics["r2"] < float(thresholds["r2_min"]):
        raise TrainingAbortError(f"Yield R2 below threshold: {metrics['r2']:.4f} < {thresholds['r2_min']}")
    if metrics["mae"] >= float(thresholds["mae_max"]):
        raise TrainingAbortError(f"Yield MAE above threshold: {metrics['mae']:.4f} >= {thresholds['mae_max']}")
