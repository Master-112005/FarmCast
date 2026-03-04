"""Population Stability Index (PSI) drift detection."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from src.core.exceptions import DriftError


@dataclass(frozen=True)
class DriftResult:
    psi: float
    status: str


def compute_psi(reference: np.ndarray, current: np.ndarray, bins: int = 10, epsilon: float = 1.0e-6) -> float:
    if reference.size == 0 or current.size == 0:
        raise DriftError("Reference and current arrays must be non-empty for PSI.")

    breakpoints = np.linspace(0.0, 100.0, bins + 1)
    cuts = np.percentile(reference, breakpoints)
    cuts[0] = -np.inf
    cuts[-1] = np.inf

    reference_hist, _ = np.histogram(reference, bins=cuts)
    current_hist, _ = np.histogram(current, bins=cuts)

    reference_dist = np.maximum(reference_hist / np.sum(reference_hist), epsilon)
    current_dist = np.maximum(current_hist / np.sum(current_hist), epsilon)
    value = float(np.sum((current_dist - reference_dist) * np.log(current_dist / reference_dist)))
    return value


def classify_psi(psi_value: float, warning_threshold: float, alert_threshold: float) -> DriftResult:
    if psi_value < warning_threshold:
        status = "stable"
    elif psi_value < alert_threshold:
        status = "warning"
    else:
        status = "alert"
    return DriftResult(psi=psi_value, status=status)
