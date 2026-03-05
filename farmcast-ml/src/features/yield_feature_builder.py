"""Yield feature engineering."""

from __future__ import annotations

import re
from typing import Any

import pandas as pd

from src.core.exceptions import DatasetValidationError
from src.features.column_normalizer import (
    normalize_yield_dataframe,
)


def _normalize_text(value: object) -> str | None:
    if pd.isna(value):
        return None
    token = str(value).strip().lower()
    token = re.sub(r"[^a-z0-9]+", "_", token)
    token = re.sub(r"_+", "_", token)
    return token.strip("_")


def build_yield_features(df: pd.DataFrame, config: dict[str, Any]) -> pd.DataFrame:
    section = config["yield"]
    forbidden = section.get("leakage_forbidden", [])
    leakage_present = [column for column in forbidden if column in df.columns]
    if leakage_present:
        raise DatasetValidationError(f"Leakage columns present in yield data: {leakage_present}")

    engineered = normalize_yield_dataframe(df)
    required = set(section["features"]["categorical"] + section["features"]["numerical"] + [section["target_column"]])
    missing_before = sorted((required - {"crop_duration_days"}) - set(engineered.columns))
    if missing_before:
        raise DatasetValidationError(f"Missing required yield feature columns: {missing_before}")

    season_map_raw = section.get("season_duration_days", {})
    if not isinstance(season_map_raw, dict) or not season_map_raw:
        raise DatasetValidationError("yield.season_duration_days must be a non-empty mapping in config.")

    season_map = {}
    for key, value in season_map_raw.items():
        normalized_key = _normalize_text(key)
        if normalized_key is None:
            continue
        season_map[normalized_key] = int(value)

    engineered["season"] = engineered["season"].map(_normalize_text)

    unknown_seasons = sorted(
        {
            season
            for season in engineered["season"].dropna().unique().tolist()
            if season not in season_map
        }
    )
    if unknown_seasons:
        raise DatasetValidationError(f"Unknown season values for duration mapping: {unknown_seasons}")

    engineered["crop_duration_days"] = engineered["season"].map(season_map)
    engineered["year"] = pd.to_numeric(engineered["year"], errors="coerce")
    engineered[section["target_column"]] = pd.to_numeric(engineered[section["target_column"]], errors="coerce")

    drop_columns = section["features"]["categorical"] + section["features"]["numerical"] + [section["target_column"]]
    engineered = engineered.dropna(subset=drop_columns).reset_index(drop=True)

    missing_after = sorted(required - set(engineered.columns))
    if missing_after:
        raise DatasetValidationError(f"Missing required yield feature columns after engineering: {missing_after}")
    if engineered.empty:
        raise DatasetValidationError("Yield feature generation produced an empty dataset after null filtering.")

    return engineered
