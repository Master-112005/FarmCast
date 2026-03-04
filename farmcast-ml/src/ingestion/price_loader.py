"""Price dataset ingestion."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from src.core.exceptions import DatasetValidationError
from src.ingestion.validator import validate_with_schema


def load_price_dataset(csv_path: str | Path, schema_path: str | Path) -> pd.DataFrame:
    path = Path(csv_path)
    if not path.exists():
        raise DatasetValidationError(f"Price dataset file not found: {path}")
    df = pd.read_csv(path)
    validate_with_schema(df, schema_path)
    return df
