"""API request/response schemas."""

from __future__ import annotations

from typing import Union

from pydantic import BaseModel, ConfigDict, Field


class YieldRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    crop_type: str
    soil_type: str
    season: str
    soil_ph: float
    soil_moisture: float
    soil_temperature: float
    rainfall_mm: float
    field_size_acre: float
    crop_duration_days: float


class YieldLegacyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    state: str
    district: str
    crop: str
    soil: str
    sowing_date: str
    field_size: float


YieldPredictionRequest = Union[YieldRequest, YieldLegacyRequest]


class YieldResponse(BaseModel):
    yield_per_hectare: float
    confidence: float | None = None
    unit: str | None = None
    model_version: str | None = None


class PriceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    crop_type: str
    mandi_id: str
    rainfall_mm: float
    demand_index: float
    lag_1: float
    lag_2: float
    lag_4: float
    rolling_mean_4: float
    seasonal_sin: float
    seasonal_cos: float
    rainfall_x_demand: float


class PriceResponse(BaseModel):
    forecast_price_inr: float
    confidence: float


class TopPrediction(BaseModel):
    label: str
    confidence: float


class DiseaseResponse(BaseModel):
    crop_type: str
    disease: str
    confidence: float
    top_3: list[TopPrediction] = Field(min_length=1, max_length=3)
    model_version: str
