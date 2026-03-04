"""Dataset validation against YAML schema contracts."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd
import yaml
from pandas.api import types as ptypes

from src.core.exceptions import DatasetValidationError, SchemaValidationError


@dataclass(frozen=True)
class ValidationReport:
    dataset_name: str
    row_count: int
    column_count: int


def load_schema(schema_path: str | Path) -> dict[str, Any]:
    path = Path(schema_path)
    if not path.exists():
        raise SchemaValidationError(f"Schema file not found: {path}")
    content = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(content, dict):
        raise SchemaValidationError(f"Schema {path} must be a mapping.")
    return content


def _validate_required_columns(df: pd.DataFrame, schema: dict[str, Any]) -> None:
    required = schema.get("required_columns")
    if not isinstance(required, list) or not all(isinstance(item, str) for item in required):
        raise SchemaValidationError("Schema key 'required_columns' must be a list[str].")
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise DatasetValidationError(f"Missing required columns: {missing}")


def _validate_strict_columns(df: pd.DataFrame, schema: dict[str, Any]) -> None:
    if not schema.get("strict_columns", False):
        return
    required = set(schema["required_columns"])
    actual = set(df.columns)
    if actual != required:
        missing = sorted(required - actual)
        extras = sorted(actual - required)
        raise DatasetValidationError(
            f"Strict column mismatch. missing={missing if missing else []}, extras={extras if extras else []}"
        )


def _validate_min_rows(df: pd.DataFrame, schema: dict[str, Any]) -> None:
    min_rows = schema.get("min_rows")
    if not isinstance(min_rows, int):
        raise SchemaValidationError("Schema key 'min_rows' must be int.")
    if len(df) < min_rows:
        raise DatasetValidationError(f"Dataset has {len(df)} rows but minimum required is {min_rows}.")


def _validate_null_fraction(df: pd.DataFrame, schema: dict[str, Any]) -> None:
    max_null_fraction = schema.get("max_null_fraction")
    if not isinstance(max_null_fraction, (float, int)):
        raise SchemaValidationError("Schema key 'max_null_fraction' must be float.")
    violations: list[str] = []
    for column in schema["required_columns"]:
        fraction = float(df[column].isna().mean())
        if fraction > float(max_null_fraction):
            violations.append(f"{column}={fraction:.4f}")
    if violations:
        raise DatasetValidationError(f"Null fraction above threshold: {violations}")


def _validate_dtype(series: pd.Series, expected_dtype: str, column: str) -> None:
    if expected_dtype == "float":
        if not ptypes.is_numeric_dtype(series):
            raise DatasetValidationError(f"Column '{column}' expected float-compatible dtype.")
        return
    if expected_dtype == "string":
        if not (ptypes.is_string_dtype(series) or ptypes.is_object_dtype(series)):
            raise DatasetValidationError(f"Column '{column}' expected string-compatible dtype.")
        return
    if expected_dtype == "datetime":
        try:
            pd.to_datetime(series, errors="raise")
        except Exception as exc:
            raise DatasetValidationError(f"Column '{column}' expected datetime-compatible values.") from exc
        return
    raise SchemaValidationError(f"Unsupported dtype '{expected_dtype}' for column '{column}'.")


def _validate_column_specs(df: pd.DataFrame, schema: dict[str, Any]) -> None:
    columns = schema.get("columns")
    if not isinstance(columns, dict):
        raise SchemaValidationError("Schema key 'columns' must be a mapping.")

    for column, spec in columns.items():
        if column not in df.columns:
            continue
        if not isinstance(spec, dict):
            raise SchemaValidationError(f"Column spec for '{column}' must be a mapping.")
        dtype = spec.get("dtype")
        nullable = spec.get("nullable")
        if dtype is None or not isinstance(dtype, str):
            raise SchemaValidationError(f"Column '{column}' must define string dtype.")
        if not isinstance(nullable, bool):
            raise SchemaValidationError(f"Column '{column}' must define boolean nullable.")
        _validate_dtype(df[column], dtype, column)
        if not nullable and df[column].isna().any():
            raise DatasetValidationError(f"Column '{column}' is non-nullable but contains null values.")


def _validate_leakage_columns(df: pd.DataFrame, schema: dict[str, Any]) -> None:
    forbidden = schema.get("leakage_forbidden", [])
    if not isinstance(forbidden, list) or not all(isinstance(item, str) for item in forbidden):
        raise SchemaValidationError("Schema key 'leakage_forbidden' must be list[str] if provided.")
    leakage_hits = [column for column in forbidden if column in df.columns]
    if leakage_hits:
        raise DatasetValidationError(f"Leakage columns present: {leakage_hits}")


def validate_dataframe(df: pd.DataFrame, schema: dict[str, Any]) -> ValidationReport:
    dataset_name = schema.get("dataset")
    if not isinstance(dataset_name, str):
        raise SchemaValidationError("Schema key 'dataset' must be string.")

    _validate_required_columns(df, schema)
    _validate_strict_columns(df, schema)
    _validate_min_rows(df, schema)
    _validate_null_fraction(df, schema)
    _validate_column_specs(df, schema)
    _validate_leakage_columns(df, schema)
    return ValidationReport(dataset_name=dataset_name, row_count=len(df), column_count=len(df.columns))


def validate_with_schema(df: pd.DataFrame, schema_path: str | Path) -> ValidationReport:
    schema = load_schema(schema_path)
    return validate_dataframe(df, schema)
