"""Feature persistence helpers."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import pandas as pd


def save_dataframe(df: pd.DataFrame, path: str | Path) -> Path:
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output, index=False)
    return output


def load_dataframe(path: str | Path) -> pd.DataFrame:
    input_path = Path(path)
    if not input_path.exists():
        raise FileNotFoundError(f"Dataframe file not found: {input_path}")
    return pd.read_csv(input_path)


def save_object(obj: Any, path: str | Path) -> Path:
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(obj, output)
    return output


def load_object(path: str | Path) -> Any:
    input_path = Path(path)
    if not input_path.exists():
        raise FileNotFoundError(f"Serialized object not found: {input_path}")
    return joblib.load(input_path)
