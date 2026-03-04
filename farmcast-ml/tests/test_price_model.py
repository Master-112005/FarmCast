from __future__ import annotations

import pandas as pd
import pytest

from src.core.exceptions import TrainingAbortError
from src.models.price.evaluator import enforce_price_thresholds
from src.models.price.utils import sequential_split


def test_sequential_split_preserves_order() -> None:
    frame = pd.DataFrame(
        {
            "week_start": pd.date_range("2024-01-01", periods=12, freq="W"),
            "price_inr": [1000.0 + i for i in range(12)],
        }
    )
    split = sequential_split(frame, "week_start", train_fraction=0.75)
    assert split.train_df["week_start"].max() < split.val_df["week_start"].min()


def test_enforce_price_thresholds_fail() -> None:
    with pytest.raises(TrainingAbortError):
        enforce_price_thresholds({"mape": 13.0, "mae": 140.0}, {"mape_max": 12.0, "mae_max": 150.0})
