"""Price feature engineering."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd

from src.core.exceptions import DatasetValidationError
from src.features.column_normalizer import (
    normalize_price_dataframe,
)


def _normalize_text(value: object) -> str:
    return str(value).strip().lower()


def _build_week_start(df: pd.DataFrame, section: dict[str, Any], time_column: str) -> pd.Series:
    calendar_cfg = section.get("calendar", {})
    year_column = calendar_cfg.get("year_column")
    week_column = calendar_cfg.get("week_column")

    if not all(isinstance(item, str) for item in [year_column, week_column]):
        raise DatasetValidationError("price.calendar config is incomplete or invalid.")

    if year_column not in df.columns or week_column not in df.columns:
        raise DatasetValidationError(
            f"Price calendar columns missing. required=[{year_column}, {week_column}]"
        )

    years = pd.to_numeric(df[year_column], errors="coerce")
    weeks = pd.to_numeric(df[week_column], errors="coerce")
    if years.isna().any() or weeks.isna().any():
        raise DatasetValidationError("Price year/week columns contain non-numeric values.")

    # Week index is used for deterministic ordering; clamp invalid weeks to safe bounds.
    years = years.astype(int)
    weeks = weeks.astype(int).clip(lower=1, upper=53)
    return pd.to_datetime(years.astype(str) + "-01-01", errors="raise") + pd.to_timedelta((weeks - 1) * 7, unit="D")


def build_price_features(df: pd.DataFrame, config: dict[str, Any]) -> pd.DataFrame:
    section = config["price"]
    time_column = section["time_column"]
    target_column = section["target_column"]
    lag_windows = section["lag_features"]
    rolling_window = section["rolling_window"]

    engineered = normalize_price_dataframe(df)

    if time_column not in engineered.columns:
        engineered[time_column] = _build_week_start(engineered, section, time_column)
    else:
        engineered[time_column] = pd.to_datetime(engineered[time_column], errors="raise")

    categorical_columns = section["features"]["categorical"]
    required = set(categorical_columns + [time_column, target_column, "rainfall_mm", "demand_index"])
    missing = sorted(required - set(engineered.columns))
    if missing:
        raise DatasetValidationError(f"Missing required columns for price features: {missing}")

    for column in categorical_columns:
        engineered[column] = engineered[column].map(_normalize_text)

    group_columns = ["state", "district", "mandi_id", "crop_type"]
    engineered = engineered.sort_values(group_columns + [time_column], kind="stable").reset_index(drop=True)

    grouped = engineered.groupby(group_columns, sort=False)[target_column]
    for lag in lag_windows:
        engineered[f"lag_{lag}"] = grouped.shift(lag)

    engineered[f"rolling_mean_{rolling_window}"] = engineered.groupby(group_columns, sort=False)[target_column].transform(
        lambda values: values.shift(1).rolling(window=rolling_window, min_periods=rolling_window).mean()
    )

    week_index = engineered[time_column].dt.isocalendar().week.astype(int)
    engineered["seasonal_sin"] = np.sin(2.0 * math.pi * week_index / 52.0)
    engineered["seasonal_cos"] = np.cos(2.0 * math.pi * week_index / 52.0)
    engineered["rainfall_x_demand"] = engineered["rainfall_mm"] * engineered["demand_index"]

    model_columns = (
        section["features"]["categorical"]
        + section["features"]["numerical"]
        + [f"lag_{lag}" for lag in lag_windows]
        + [f"rolling_mean_{rolling_window}"]
        + [target_column]
    )
    engineered = engineered.dropna(subset=model_columns).reset_index(drop=True)
    if engineered.empty:
        raise DatasetValidationError("Price feature generation produced an empty dataset after lag filtering.")
    return engineered
