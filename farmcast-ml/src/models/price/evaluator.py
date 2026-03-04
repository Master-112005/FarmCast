"""Price model evaluation."""

from __future__ import annotations

import numpy as np

from src.core.exceptions import TrainingAbortError
from src.core.metrics import regression_metrics


def evaluate_price_model(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    return regression_metrics(y_true, y_pred)


def enforce_price_thresholds(metrics: dict[str, float], thresholds: dict[str, float]) -> None:
    if metrics["mape"] >= float(thresholds["mape_max"]):
        raise TrainingAbortError(f"Price MAPE above threshold: {metrics['mape']:.4f} >= {thresholds['mape_max']}")
    if metrics["mae"] >= float(thresholds["mae_max"]):
        raise TrainingAbortError(f"Price MAE above threshold: {metrics['mae']:.4f} >= {thresholds['mae_max']}")
