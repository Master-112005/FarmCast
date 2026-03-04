"""Disease predictor."""

from __future__ import annotations

import io
from pathlib import Path

import numpy as np
from PIL import Image

from src.core.exceptions import InferenceError
from src.models.disease.utils import load_class_map, parse_class_label


class DiseasePredictor:
    def __init__(
        self,
        model_path: str | Path,
        class_map_path: str | Path,
        image_size: tuple[int, int],
        top_k: int = 3,
    ) -> None:
        try:
            import tensorflow as tf  # type: ignore
        except Exception as exc:  # pragma: no cover
            raise ImportError("TensorFlow is required for disease inference.") from exc

        self._tf = tf
        self.model = tf.keras.models.load_model(Path(model_path), compile=False)
        class_map = load_class_map(class_map_path)
        self.index_to_class = {idx: label for label, idx in class_map.items()}
        self.image_size = image_size
        self.top_k = top_k

    def _preprocess(self, image_bytes: bytes) -> np.ndarray:
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception as exc:
            raise InferenceError("Invalid image payload.") from exc
        image = image.resize(self.image_size)
        arr = np.asarray(image, dtype=np.float32)
        arr = np.expand_dims(arr, axis=0)
        arr = self._tf.keras.applications.mobilenet_v3.preprocess_input(arr)
        return arr

    def predict(self, image_bytes: bytes, model_version: str) -> dict[str, object]:
        tensor = self._preprocess(image_bytes)
        probs = self.model.predict(tensor, verbose=0)[0]
        top_indices = np.argsort(probs)[::-1][: self.top_k]
        top = [
            {"label": self.index_to_class[int(index)], "confidence": float(probs[int(index)])}
            for index in top_indices
        ]
        primary_label = top[0]["label"]
        crop_type, disease = parse_class_label(primary_label)
        return {
            "crop_type": crop_type,
            "disease": disease,
            "confidence": float(top[0]["confidence"]),
            "top_3": top,
            "model_version": model_version,
        }
