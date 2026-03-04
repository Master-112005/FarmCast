"""Weather dataset ingestion."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from src.core.exceptions import DatasetValidationError


def load_weather_dataset(csv_path: str | Path) -> pd.DataFrame:
    path = Path(csv_path)
    if not path.exists():
        raise DatasetValidationError(f"Weather dataset file not found: {path}")
    df = pd.read_csv(path)
    if df.empty:
        raise DatasetValidationError("Weather dataset is empty.")
    return df
