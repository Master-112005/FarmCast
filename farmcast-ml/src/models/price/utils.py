"""Price model utilities."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder

from src.core.exceptions import DatasetValidationError


@dataclass(frozen=True)
class SplitBundle:
    train_df: pd.DataFrame
    val_df: pd.DataFrame


def validate_min_rows(df: pd.DataFrame, min_rows: int) -> None:
    if len(df) < min_rows:
        raise DatasetValidationError(f"Price training requires >= {min_rows} rows, got {len(df)}.")


def sequential_split(df: pd.DataFrame, time_column: str, train_fraction: float) -> SplitBundle:
    if not 0.0 < train_fraction < 1.0:
        raise DatasetValidationError("train_fraction must be between 0 and 1.")
    ordered = df.copy()
    ordered[time_column] = pd.to_datetime(ordered[time_column], errors="raise")
    ordered = ordered.sort_values(time_column, kind="stable").reset_index(drop=True)
    split_idx = int(len(ordered) * train_fraction)
    if split_idx <= 0 or split_idx >= len(ordered):
        raise DatasetValidationError("Invalid sequential split index.")
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
        raise DatasetValidationError(f"Price dataframe missing columns: {missing}")
    return df[feature_columns].copy(), df[target_column].copy()


def build_feature_columns(config: dict[str, Any]) -> tuple[list[str], list[str], list[str]]:
    section = config["price"]
    categorical = section["features"]["categorical"]
    base_numerical = section["features"]["numerical"]
    lag_features = [f"lag_{lag}" for lag in section["lag_features"]]
    rolling_name = f"rolling_mean_{section['rolling_window']}"

    numerical = [*base_numerical, *lag_features, rolling_name]
    return categorical + numerical, categorical, numerical
