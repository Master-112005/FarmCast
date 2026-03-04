from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from src.core.exceptions import DatasetValidationError
from src.ingestion.price_loader import load_price_dataset
from src.ingestion.yield_loader import load_yield_dataset


def _yield_frame(rows: int = 300) -> pd.DataFrame:
    base_date = pd.Timestamp("2024-01-01")
    return pd.DataFrame(
        {
            "farm_id": [f"f{i}" for i in range(rows)],
            "observed_at": [base_date + pd.Timedelta(days=i) for i in range(rows)],
            "crop_type": ["rice"] * rows,
            "soil_type": ["alluvial"] * rows,
            "season": ["kharif"] * rows,
            "planting_date": [base_date] * rows,
            "harvest_date": [base_date + pd.Timedelta(days=100)] * rows,
            "soil_ph": [6.5] * rows,
            "soil_moisture": [30.0] * rows,
            "soil_temperature": [24.5] * rows,
            "rainfall_mm": [120.0] * rows,
            "field_size_acre": [2.0] * rows,
            "yield_qt_per_hectare": [22.0] * rows,
        }
    )


def _price_frame(rows: int = 40) -> pd.DataFrame:
    base_date = pd.Timestamp("2024-01-01")
    return pd.DataFrame(
        {
            "mandi_id": ["m1"] * rows,
            "crop_type": ["rice"] * rows,
            "week_start": [base_date + pd.Timedelta(days=7 * i) for i in range(rows)],
            "price_inr": [1800.0 + i for i in range(rows)],
            "rainfall_mm": [100.0] * rows,
            "demand_index": [1.1] * rows,
        }
    )


def test_load_yield_dataset_success(tmp_path: Path) -> None:
    csv_path = tmp_path / "yield.csv"
    _yield_frame(320).to_csv(csv_path, index=False)
    df = load_yield_dataset(csv_path, "configs/schemas/yield_schema.yaml")
    assert len(df) == 320


def test_load_yield_dataset_fails_missing_column(tmp_path: Path) -> None:
    csv_path = tmp_path / "yield_bad.csv"
    frame = _yield_frame(320).drop(columns=["soil_ph"])
    frame.to_csv(csv_path, index=False)
    with pytest.raises(DatasetValidationError):
        load_yield_dataset(csv_path, "configs/schemas/yield_schema.yaml")


def test_load_price_dataset_success(tmp_path: Path) -> None:
    csv_path = tmp_path / "price.csv"
    _price_frame(50).to_csv(csv_path, index=False)
    df = load_price_dataset(csv_path, "configs/schemas/price_schema.yaml")
    assert len(df) == 50
