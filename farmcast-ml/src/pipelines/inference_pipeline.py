"""Inference pipeline with lazy-loaded production models."""

from __future__ import annotations

from pathlib import Path
from typing import Any
import argparse
import json
from importlib import import_module

from src.core.config import ConfigLoader
from src.models.disease.predictor import DiseasePredictor
from src.models.price.predictor import PricePredictor
from src.pipelines.utils import read_json


YieldPredictor = import_module("src.models.yield.predictor").YieldPredictor


class InferencePipeline:
    def __init__(self, app_config_path: str = "configs/app_config.yaml") -> None:
        loader = ConfigLoader()
        config = loader.load_app_config(app_config_path)
        self.inference_cfg = config["inference"]
        self.model_paths = config["inference"]["production_models"]
        self._yield_predictor: YieldPredictor | None = None
        self._price_predictor: PricePredictor | None = None
        self._disease_predictor: DiseasePredictor | None = None
        self._disease_version = "unknown"

    def _resolve_path(self, key: str, label: str) -> Path:
        path = Path(self.model_paths[key])
        if not path.exists():
            raise FileNotFoundError(f"{label} not found: {path}")
        return path

    def _load_yield_predictor(self) -> YieldPredictor:
        if self._yield_predictor is not None:
            return self._yield_predictor
        model_path = self._resolve_path("yield_model", "Yield model")
        preprocessor_path = self._resolve_path("yield_preprocessor", "Yield preprocessor")
        metadata = read_json(model_path.parent / "metadata.json")
        self._yield_predictor = YieldPredictor(
            model_path=model_path,
            preprocessor_path=preprocessor_path,
            residual_std=float(metadata["residual_std"]),
        )
        return self._yield_predictor

    def _load_price_predictor(self) -> PricePredictor:
        if self._price_predictor is not None:
            return self._price_predictor
        model_path = self._resolve_path("price_model", "Price model")
        preprocessor_path = self._resolve_path("price_preprocessor", "Price preprocessor")
        metadata = read_json(model_path.parent / "metadata.json")
        self._price_predictor = PricePredictor(
            model_path=model_path,
            preprocessor_path=preprocessor_path,
            residual_std=float(metadata["residual_std"]),
        )
        return self._price_predictor

    def _load_disease_predictor(self) -> DiseasePredictor:
        if self._disease_predictor is not None:
            return self._disease_predictor
        model_path = self._resolve_path("disease_model", "Disease model")
        class_map_path = self._resolve_path("disease_classes", "Disease class map")
        metadata = read_json(model_path.parent / "metadata.json")
        self._disease_version = metadata.get("version", "unknown")
        self._disease_predictor = DiseasePredictor(
            model_path=model_path,
            class_map_path=class_map_path,
            image_size=tuple(self.inference_cfg["disease_image_size"]),
            top_k=int(self.inference_cfg["disease_top_k"]),
        )
        return self._disease_predictor

    def predict(self, task: str, payload: Any) -> dict[str, Any]:
        if task == "yield":
            if not isinstance(payload, dict):
                raise TypeError("Yield payload must be dictionary.")
            predictor = self._load_yield_predictor()
            return predictor.predict(payload)
        if task == "price":
            if not isinstance(payload, dict):
                raise TypeError("Price payload must be dictionary.")
            predictor = self._load_price_predictor()
            return predictor.predict(payload)
        if task == "disease":
            if not isinstance(payload, (bytes, bytearray)):
                raise TypeError("Disease payload must be image bytes.")
            predictor = self._load_disease_predictor()
            return predictor.predict(bytes(payload), model_version=self._disease_version)
        raise ValueError(f"Unsupported inference task '{task}'.")


def main() -> None:
    parser = argparse.ArgumentParser(description="FarmCast inference pipeline")
    parser.add_argument("--task", required=True, choices=["yield", "price", "disease"])
    parser.add_argument("--payload-json", help="JSON payload for yield/price tasks")
    parser.add_argument("--image-path", help="Image path for disease task")
    args = parser.parse_args()

    pipeline = InferencePipeline()
    if args.task in {"yield", "price"}:
        if not args.payload_json:
            raise ValueError("--payload-json is required for yield/price.")
        payload = json.loads(args.payload_json)
        print(json.dumps(pipeline.predict(args.task, payload), indent=2))
        return
    if not args.image_path:
        raise ValueError("--image-path is required for disease.")
    image_bytes = Path(args.image_path).read_bytes()
    print(json.dumps(pipeline.predict("disease", image_bytes), indent=2))


if __name__ == "__main__":
    main()
