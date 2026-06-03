"""Geo-aware yield inference gateway."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from src.core.observability import log_event, monotonic
from src.features.build_geo_feature_vector import (
    build_feature_vector,
)


REQUIRED_KEYS = (
    "state",
    "district",
    "crop",
    "soil",
    "sowing_date",
)

MODEL_VERSION = "v2"

MODEL_DIR = (
    Path(__file__).resolve().parents[2]
    / "models"
    / "yield"
    / MODEL_VERSION
)

MODEL_PATH = MODEL_DIR / "model.pkl"
METADATA_PATH = MODEL_DIR / "metadata.json"




TON_TO_QUINTAL = 10.0

_MODEL_CACHE = None
_METADATA_CACHE: dict[str, Any] | None = None
logger = logging.getLogger("farmcast.ml.yield_legacy")



def _load_model():
    global _MODEL_CACHE
    if _MODEL_CACHE is None:
        load_start = monotonic()
        log_event(logger, "legacy_yield_model_load_begin", start=load_start, task="yield", stage="model_load")
        _MODEL_CACHE = joblib.load(MODEL_PATH)
        log_event(
            logger,
            "legacy_yield_model_load_end",
            start=load_start,
            task="yield",
            stage="model_load",
            model_path=str(MODEL_PATH),
        )
    return _MODEL_CACHE


def _load_metadata() -> dict[str, Any]:
    global _METADATA_CACHE
    if _METADATA_CACHE is None:
        load_start = monotonic()
        log_event(logger, "legacy_yield_metadata_load_begin", start=load_start, task="yield", stage="model_load")
        with METADATA_PATH.open("r", encoding="utf-8") as file_obj:
            _METADATA_CACHE = json.load(file_obj)
        log_event(
            logger,
            "legacy_yield_metadata_load_end",
            start=load_start,
            task="yield",
            stage="model_load",
            metadata_path=str(METADATA_PATH),
        )
    return _METADATA_CACHE


def warm_up_model() -> None:
    """Load the legacy yield model and metadata once during startup."""
    warmup_start = monotonic()
    log_event(logger, "legacy_yield_warmup_begin", start=warmup_start, task="yield", stage="startup")
    _load_model()
    _load_metadata()
    log_event(logger, "legacy_yield_warmup_end", start=warmup_start, task="yield", stage="startup")



def _validate_payload(payload: dict) -> dict[str, str]:
    if not isinstance(payload, dict):
        raise ValueError("Payload must be a dictionary.")

    missing = []
    for key in REQUIRED_KEYS:
        value = payload.get(key)
        if value is None or str(value).strip() == "":
            missing.append(key)

    if missing:
        raise ValueError(
            f"Missing required payload keys: {missing}"
        )

    return {
        key: str(payload[key]).strip()
        for key in REQUIRED_KEYS
    }



def _apply_encoder_mappings(
    frame: pd.DataFrame,
    metadata: dict[str, Any],
) -> pd.DataFrame:
    mappings = (
        metadata.get("encoder_mappings")
        or metadata.get("encoders")
    )

    if mappings is None:
        return frame

    if not isinstance(mappings, dict):
        raise ValueError(
            "Invalid encoder mappings in metadata."
        )

    encoded = frame.copy()

    for column, mapping in mappings.items():
        if column not in encoded.columns:
            raise ValueError(
                f"Encoder mapping column missing: {column}"
            )

        if not isinstance(mapping, dict):
            raise ValueError(
                f"Encoder mapping for {column} must be a dictionary."
            )

        mapped = encoded[column].map(mapping)

        if mapped.isna().any():
            unknown = sorted(
                {
                    str(value)
                    for value in encoded.loc[
                        mapped.isna(), column
                    ].tolist()
                }
            )
            raise ValueError(
                f"Missing encoder mapping for {column}: {unknown}"
            )

        encoded[column] = mapped

    return encoded



def predict_yield(payload: dict) -> dict:
    """Predict yield per hectare from geo-aware payload.

    MODEL OUTPUT UNIT  : tons/hectare
    API RESPONSE UNIT  : quintals/hectare
    """

    prediction_start = monotonic()
    log_event(logger, "legacy_yield_prediction_begin", start=prediction_start, task="yield", stage="inference")
    validated_payload = _validate_payload(payload)

    feature_vector = build_feature_vector(
        state=validated_payload["state"],
        district=validated_payload["district"],
        crop=validated_payload["crop"],
        soil=validated_payload["soil"],
        sowing_date=validated_payload["sowing_date"],
    )

    features_df = pd.DataFrame([feature_vector])

    metadata = _load_metadata()

    feature_columns = metadata.get("feature_columns")
    if (
        not isinstance(feature_columns, list)
        or not feature_columns
    ):
        raise ValueError(
            "Model metadata missing feature_columns."
        )


    missing_columns = [
        column
        for column in feature_columns
        if column not in features_df.columns
    ]
    if missing_columns:
        raise ValueError(
            f"Missing feature columns: {missing_columns}"
        )

    extra_columns = [
        column
        for column in features_df.columns
        if column not in feature_columns
    ]
    if extra_columns:
        raise ValueError(
            f"Unexpected feature columns: {extra_columns}"
        )

    X = features_df[feature_columns]
    X = _apply_encoder_mappings(X, metadata)

    if X.isna().any().any():
        raise ValueError(
            "NaN values detected in inference features."
        )


    model = _load_model()


    prediction_ton_per_ha = float(model.predict(X)[0])


    prediction_quintal_per_ha = prediction_ton_per_ha * TON_TO_QUINTAL


    prediction_quintal_per_ha = round(prediction_quintal_per_ha, 3)

    result = {
        "yield_per_hectare": prediction_quintal_per_ha,
        "unit": "quintal_per_hectare",
        "model_version": str(
            metadata.get("model_version", MODEL_VERSION)
        ),
    }
    log_event(
        logger,
        "legacy_yield_prediction_end",
        start=prediction_start,
        task="yield",
        stage="inference",
        model_version=result["model_version"],
    )
    return result
