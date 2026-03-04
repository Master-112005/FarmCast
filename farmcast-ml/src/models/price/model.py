"""Price LightGBM model factory."""

from __future__ import annotations

from typing import Any


def build_price_regressor(params: dict[str, Any], seed: int):
    try:
        import lightgbm as lgb
    except Exception as exc:  # pragma: no cover
        raise ImportError("lightgbm is required for price training.") from exc

    merged = dict(params)
    merged["random_state"] = seed
    return lgb.LGBMRegressor(**merged)
