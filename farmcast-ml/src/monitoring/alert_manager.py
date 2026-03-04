"""Alert manager utilities."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AlertEvent:
    category: str
    severity: str
    message: str


def build_drift_alert(status: str, psi_value: float) -> AlertEvent | None:
    if status == "stable":
        return None
    severity = "warning" if status == "warning" else "critical"
    return AlertEvent(
        category="drift",
        severity=severity,
        message=f"PSI drift status={status}, value={psi_value:.4f}",
    )


def build_performance_alert(metric_name: str, value: float, threshold: float) -> AlertEvent | None:
    if value < threshold:
        return None
    return AlertEvent(
        category="performance",
        severity="critical",
        message=f"{metric_name}={value:.4f} exceeded threshold={threshold:.4f}",
    )
