"""Price predictor."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from src.core.exceptions import InferenceError
from src.features.persistence import load_object


class PricePredictor:
    def __init__(self, model_path: str | Path, preprocessor_path: str | Path, residual_std: float) -> None:
        self.model = load_object(model_path)
        self.preprocessor = load_object(preprocessor_path)
        self.residual_std = float(residual_std)

    def predict(self, payload: dict[str, Any]) -> dict[str, float]:
        frame = pd.DataFrame([payload])
        try:
            transformed = self.preprocessor.transform(frame)
            value = float(self.model.predict(transformed)[0])
        except Exception as exc:
            raise InferenceError(f"Price inference failed: {exc}") from exc
        confidence = float(max(0.0, 1.0 - min(self.residual_std / (abs(value) + 1.0e-8), 1.0)))
        return {"forecast_price_inr": value, "confidence": confidence}
