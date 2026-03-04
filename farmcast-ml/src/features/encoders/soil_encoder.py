"""Soil encoder."""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd
from sklearn.preprocessing import OrdinalEncoder

from src.core.exceptions import DatasetValidationError


@dataclass
class SoilEncoder:
    categories: list[str]
    column: str = "soil_type"

    def __post_init__(self) -> None:
        if not self.categories:
            raise DatasetValidationError("SoilEncoder requires non-empty categories.")
        self._encoder = OrdinalEncoder(
            categories=[self.categories],
            handle_unknown="use_encoded_value",
            unknown_value=-1,
            dtype=float,
        )
        self._fitted = False

    def fit(self, df: pd.DataFrame) -> None:
        if self.column not in df.columns:
            raise DatasetValidationError(f"Missing soil column: {self.column}")
        self._encoder.fit(df[[self.column]])
        self._fitted = True

    def transform(self, df: pd.DataFrame) -> pd.Series:
        if not self._fitted:
            raise DatasetValidationError("SoilEncoder is not fitted.")
        return pd.Series(self._encoder.transform(df[[self.column]]).ravel(), index=df.index, name=self.column)
