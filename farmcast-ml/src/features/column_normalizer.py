"""Column normalization for legacy and canonical FarmCast datasets."""

from __future__ import annotations

import pandas as pd


LEGACY_YIELD_REQUIRED_COLUMNS = (
    "crop_type",
    "soil_type",
    "season",
    "soil_ph",
    "soil_moisture",
    "soil_temperature",
    "rainfall_mm",
    "field_size_acre",
    "yield_qt_per_hectare",
)


def _derive_year(frame: pd.DataFrame, candidates: tuple[str, ...]) -> pd.Series:
    for column in candidates:
        if column not in frame.columns:
            continue
        parsed = pd.to_datetime(frame[column], errors="coerce")
        if not parsed.notna().any():
            continue
        return parsed.dt.year.astype("float64")
    return pd.Series([pd.NA] * len(frame), index=frame.index, dtype="float64")


def _derive_season_from_week_start(week_start: pd.Series) -> pd.Series:
    parsed = pd.to_datetime(week_start, errors="coerce")
    month = parsed.dt.month
    season = pd.Series("unknown", index=week_start.index, dtype="object")
    season = season.mask(month.isin([6, 7, 8, 9]), "kharif")
    season = season.mask(month.isin([10, 11, 12, 1, 2, 3]), "rabi")
    season = season.mask(month.isin([4, 5]), "zaid")
    return season


def normalize_yield_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    normalized = df.copy()

    alias_columns = {
        "rainfall_mm": "rainfall_mm_total",
        "soil_temperature": "avg_temperature_c",
        "soil_moisture": "avg_humidity",
        "field_size_acre": "Area",
        "yield_qt_per_hectare": "yield_per_hectare",
    }
    for source, target in alias_columns.items():
        if target not in normalized.columns and source in normalized.columns:
            normalized[target] = normalized[source]

    if "Yield" not in normalized.columns and "yield_per_hectare" in normalized.columns:
        normalized["Yield"] = normalized["yield_per_hectare"]

    if "year" not in normalized.columns:
        normalized["year"] = _derive_year(
            normalized,
            ("observed_at", "harvest_date", "planting_date"),
        )

    if "state" not in normalized.columns:
        normalized["state"] = "unknown"
    if "district" not in normalized.columns:
        normalized["district"] = "unknown"
    if "season" not in normalized.columns:
        normalized["season"] = "unknown"

    return normalized


def normalize_price_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    normalized = df.copy()

    if "mandi_id" not in normalized.columns and "mandi_name" in normalized.columns:
        normalized["mandi_id"] = normalized["mandi_name"]
    if "mandi_name" not in normalized.columns and "mandi_id" in normalized.columns:
        normalized["mandi_name"] = normalized["mandi_id"]

    if "price_per_quintal" not in normalized.columns and "price_inr" in normalized.columns:
        normalized["price_per_quintal"] = normalized["price_inr"]

    if "week_start" in normalized.columns:
        week_start = pd.to_datetime(normalized["week_start"], errors="coerce")
        if "week_number" not in normalized.columns:
            normalized["week_number"] = week_start.dt.isocalendar().week.astype("float64")
        if "year" not in normalized.columns:
            normalized["year"] = week_start.dt.isocalendar().year.astype("float64")
        if "season" not in normalized.columns:
            normalized["season"] = _derive_season_from_week_start(week_start)

    if "state" not in normalized.columns:
        normalized["state"] = "unknown"
    if "district" not in normalized.columns:
        normalized["district"] = "unknown"
    if "season" not in normalized.columns:
        normalized["season"] = "unknown"

    return normalized
