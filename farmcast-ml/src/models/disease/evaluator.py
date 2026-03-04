"""Disease model evaluation."""

from __future__ import annotations

import numpy as np

from src.core.exceptions import TrainingAbortError
from src.core.metrics import classification_metrics, confusion_matrix


def evaluate_disease_predictions(
    y_true: np.ndarray, y_pred: np.ndarray, class_labels: list[int]
) -> dict[str, object]:
    metrics = classification_metrics(y_true, y_pred)
    matrix = confusion_matrix(y_true, y_pred, class_labels)
    result: dict[str, object] = dict(metrics)
    result["confusion_matrix"] = matrix
    return result


def enforce_disease_thresholds(metrics: dict[str, object], thresholds: dict[str, float]) -> None:
    accuracy = float(metrics["accuracy"])
    recall = float(metrics["recall_macro"])
    if accuracy < float(thresholds["accuracy_min"]):
        raise TrainingAbortError(f"Disease accuracy below threshold: {accuracy:.4f} < {thresholds['accuracy_min']}")
    if recall < float(thresholds["recall_min"]):
        raise TrainingAbortError(f"Disease recall below threshold: {recall:.4f} < {thresholds['recall_min']}")
