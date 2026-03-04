from __future__ import annotations

import io

from fastapi.testclient import TestClient
from PIL import Image

import src.api.ml_service as ml_service


class _DummyPipeline:
    def predict(self, task: str, payload):
        if task == "yield":
            return {"yield_per_hectare": 20.5, "confidence": 0.91}
        if task == "price":
            return {"forecast_price_inr": 1800.0, "confidence": 0.88}
        return {
            "crop_type": "rice",
            "disease": "blast",
            "confidence": 0.93,
            "top_3": [
                {"label": "rice__blast", "confidence": 0.93},
                {"label": "rice__brown_spot", "confidence": 0.05},
                {"label": "rice__healthy", "confidence": 0.02},
            ],
            "model_version": "disease_v1.0.0",
        }


def _image_bytes() -> bytes:
    image = Image.new("RGB", (10, 10), color=(10, 120, 40))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_api_endpoints(monkeypatch) -> None:
    monkeypatch.setenv("FARMCAST_API_KEY", "secret")

    dummy = _DummyPipeline()
    original_dependency = ml_service.get_inference_pipeline
    ml_service.app.dependency_overrides[original_dependency] = lambda: dummy
    ml_service.get_inference_pipeline = lambda: dummy  # startup hook call

    client = TestClient(ml_service.app)
    headers = {"X-API-Key": "secret"}
    bearer_headers = {"Authorization": "Bearer secret"}

    yield_payload = {
        "crop_type": "rice",
        "soil_type": "alluvial",
        "season": "kharif",
        "soil_ph": 6.5,
        "soil_moisture": 30.0,
        "soil_temperature": 24.0,
        "rainfall_mm": 120.0,
        "field_size_acre": 2.5,
        "crop_duration_days": 95.0,
    }
    response = client.post("/predict/yield", json=yield_payload, headers=headers)
    assert response.status_code == 200
    assert "yield_per_hectare" in response.json()

    response = client.post("/predict/yield", json=yield_payload, headers=bearer_headers)
    assert response.status_code == 200
    assert "yield_per_hectare" in response.json()

    price_payload = {
        "crop_type": "rice",
        "mandi_id": "m1",
        "rainfall_mm": 120.0,
        "demand_index": 1.2,
        "lag_1": 1700.0,
        "lag_2": 1680.0,
        "lag_4": 1650.0,
        "rolling_mean_4": 1670.0,
        "seasonal_sin": 0.5,
        "seasonal_cos": 0.8,
        "rainfall_x_demand": 144.0,
    }
    response = client.post("/predict/price", json=price_payload, headers=headers)
    assert response.status_code == 200
    assert "forecast_price_inr" in response.json()

    response = client.post(
        "/predict/disease",
        files={"file": ("leaf.png", _image_bytes(), "image/png")},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["disease"] == "blast"

    ml_service.app.dependency_overrides.clear()
