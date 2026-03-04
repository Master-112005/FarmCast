from __future__ import annotations

import numpy as np
import pandas as pd
import pytest
from importlib import import_module

from src.core.exceptions import TrainingAbortError

enforce_yield_thresholds = import_module("src.models.yield.evaluator").enforce_yield_thresholds
time_aware_split = import_module("src.models.yield.utils").time_aware_split


def test_time_aware_split_preserves_order() -> None:
    frame = pd.DataFrame(
        {
            "observed_at": pd.date_range("2024-01-01", periods=10, freq="D"),
            "yield_qt_per_hectare": np.arange(10, dtype=float),
        }
    )
    split = time_aware_split(frame, "observed_at", train_fraction=0.8)
    assert split.train_df["observed_at"].max() < split.val_df["observed_at"].min()


def test_enforce_yield_thresholds_fail() -> None:
    with pytest.raises(TrainingAbortError):
        enforce_yield_thresholds({"r2": 0.8, "mae": 7.0}, {"r2_min": 0.85, "mae_max": 8.0})
