"""Yield model utilities."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd
from pandas.api import types as ptypes
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder

from src.core.exceptions import DatasetValidationError


@dataclass(frozen=True)
class SplitBundle:
    train_df: pd.DataFrame
    val_df: pd.DataFrame


def validate_min_rows(df: pd.DataFrame, min_rows: int) -> None:
    if len(df) < min_rows:
        raise DatasetValidationError(f"Yield training requires >= {min_rows} rows, got {len(df)}.")


def time_aware_split(df: pd.DataFrame, time_column: str, train_fraction: float) -> SplitBundle:
    if not 0.0 < train_fraction < 1.0:
        raise DatasetValidationError(f"train_fraction must be between 0 and 1, got {train_fraction}")
    ordered = df.copy()
    if time_column not in ordered.columns:
        raise DatasetValidationError(f"Yield time column missing: {time_column}")

    if ptypes.is_numeric_dtype(ordered[time_column]):
        ordered[time_column] = pd.to_numeric(ordered[time_column], errors="raise")
    else:
        ordered[time_column] = pd.to_datetime(ordered[time_column], errors="raise")

    ordered = ordered.sort_values(time_column, kind="stable").reset_index(drop=True)
    split_idx = int(len(ordered) * train_fraction)
    if split_idx <= 0 or split_idx >= len(ordered):
        raise DatasetValidationError("Invalid split index for yield time-aware split.")
    return SplitBundle(train_df=ordered.iloc[:split_idx].copy(), val_df=ordered.iloc[split_idx:].copy())


def build_preprocessor(categorical_features: list[str], numerical_features: list[str]) -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_features),
            ("num", "passthrough", numerical_features),
        ],
        remainder="drop",
    )


def extract_xy(df: pd.DataFrame, feature_columns: list[str], target_column: str) -> tuple[pd.DataFrame, pd.Series]:
    missing = sorted(set(feature_columns + [target_column]) - set(df.columns))
    if missing:
        raise DatasetValidationError(f"Yield dataframe missing columns: {missing}")
    return df[feature_columns].copy(), df[target_column].copy()


def build_feature_columns(config: dict[str, Any]) -> tuple[list[str], list[str], list[str]]:
    categorical = config["yield"]["features"]["categorical"]
    numerical = config["yield"]["features"]["numerical"]
    return categorical + numerical, categorical, numerical
