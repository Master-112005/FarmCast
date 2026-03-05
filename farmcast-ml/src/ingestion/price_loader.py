"""Price dataset ingestion."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from src.core.exceptions import DatasetValidationError
from src.features.column_normalizer import normalize_price_dataframe
from src.ingestion.validator import load_schema, validate_dataframe


def load_price_dataset(csv_path: str | Path, schema_path: str | Path) -> pd.DataFrame:
    path = Path(csv_path)
    if not path.exists():
        raise DatasetValidationError(f"Price dataset file not found: {path}")
    raw = pd.read_csv(path)
    normalized = normalize_price_dataframe(raw)
    schema = load_schema(schema_path)
    required_columns = schema["required_columns"]
    compact = normalized[
        [column for column in normalized.columns if column in required_columns]
    ].copy()
    validate_dataframe(compact, schema)
    return compact
