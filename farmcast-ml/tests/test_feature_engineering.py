from __future__ import annotations

import pandas as pd
import pytest

from src.core.config import ConfigLoader
from src.core.exceptions import DatasetValidationError
from src.features.price_feature_builder import build_price_features
from src.features.yield_feature_builder import build_yield_features


def test_yield_feature_builder_adds_crop_duration() -> None:
    config = ConfigLoader().load_training_config("configs/training_config.yaml")
    frame = pd.DataFrame(
        {
            "farm_id": ["f1"],
            "observed_at": ["2024-01-01"],
            "crop_type": ["rice"],
            "soil_type": ["alluvial"],
            "season": ["kharif"],
            "planting_date": ["2023-10-01"],
            "harvest_date": ["2024-01-01"],
            "soil_ph": [6.5],
            "soil_moisture": [32.0],
            "soil_temperature": [25.0],
            "rainfall_mm": [120.0],
            "field_size_acre": [2.0],
            "yield_qt_per_hectare": [21.0],
        }
    )
    transformed = build_yield_features(frame, config)
    assert "crop_duration_days" in transformed.columns
    assert int(transformed.loc[0, "crop_duration_days"]) > 0


def test_yield_feature_builder_blocks_leakage() -> None:
    config = ConfigLoader().load_training_config("configs/training_config.yaml")
    frame = pd.DataFrame(
        {
            "farm_id": ["f1"],
            "observed_at": ["2024-01-01"],
            "crop_type": ["rice"],
            "soil_type": ["alluvial"],
            "season": ["kharif"],
            "planting_date": ["2023-10-01"],
            "harvest_date": ["2024-01-01"],
            "soil_ph": [6.5],
            "soil_moisture": [32.0],
            "soil_temperature": [25.0],
            "rainfall_mm": [120.0],
            "field_size_acre": [2.0],
            "yield_qt_per_hectare": [21.0],
            "fertilizer_recommendation": ["high-nitrogen"],
        }
    )
    with pytest.raises(DatasetValidationError):
        build_yield_features(frame, config)


def test_price_feature_builder_creates_lags() -> None:
    config = ConfigLoader().load_training_config("configs/training_config.yaml")
    rows = 16
    frame = pd.DataFrame(
        {
            "mandi_id": ["m1"] * rows,
            "crop_type": ["rice"] * rows,
            "week_start": pd.date_range("2024-01-01", periods=rows, freq="W"),
            "price_inr": [1000.0 + i for i in range(rows)],
            "rainfall_mm": [10.0] * rows,
            "demand_index": [1.2] * rows,
        }
    )
    transformed = build_price_features(frame, config)
    assert {"lag_1", "lag_2", "lag_4", "rolling_mean_4", "rainfall_x_demand"}.issubset(transformed.columns)
    assert len(transformed) < len(frame)
