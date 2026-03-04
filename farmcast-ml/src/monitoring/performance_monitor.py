"""Rolling performance monitoring."""

from __future__ import annotations

from collections import deque

import numpy as np


class RollingMetricMonitor:
    def __init__(self, window_size: int) -> None:
        if window_size <= 0:
            raise ValueError("window_size must be positive.")
        self.window_size = window_size
        self.errors: deque[float] = deque(maxlen=window_size)

    def update(self, y_true: float, y_pred: float) -> None:
        self.errors.append(abs(float(y_true) - float(y_pred)))

    def rolling_mae(self) -> float:
        if not self.errors:
            return 0.0
        return float(np.mean(self.errors))

    def should_alert(self, threshold: float) -> bool:
        if len(self.errors) < self.window_size:
            return False
        return self.rolling_mae() >= float(threshold)
