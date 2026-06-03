"""Disease predictor."""

from __future__ import annotations

import io
import logging
from pathlib import Path

import numpy as np
from PIL import Image

from src.core.exceptions import InferenceError
from src.core.observability import log_event, monotonic
from src.models.disease.utils import load_class_map, parse_class_label


logger = logging.getLogger("farmcast.ml.disease")


class DiseasePredictor:
    def __init__(
        self,
        model_path: str | Path,
        class_map_path: str | Path,
        image_size: tuple[int, int],
        top_k: int = 3,
    ) -> None:
        init_start = monotonic()
        try:
            tf_import_start = monotonic()
            log_event(logger, "tensorflow_import_begin", start=tf_import_start, task="disease", stage="tensorflow")
            import tensorflow as tf
            log_event(
                logger,
                "tensorflow_import_end",
                start=tf_import_start,
                task="disease",
                stage="tensorflow",
                tensorflow_version=getattr(tf, "__version__", "unknown"),
            )
        except Exception as exc:
            log_event(
                logger,
                "tensorflow_import_failed",
                severity="error",
                start=init_start,
                task="disease",
                stage="tensorflow",
                exc=exc,
            )
            raise ImportError("TensorFlow is required for disease inference.") from exc

        self._tf = tf
        model_load_start = monotonic()
        log_event(
            logger,
            "keras_model_load_begin",
            start=model_load_start,
            task="disease",
            stage="model_load",
            model_path=str(model_path),
        )
        self.model = tf.keras.models.load_model(Path(model_path), compile=False)
        log_event(
            logger,
            "keras_model_load_end",
            start=model_load_start,
            task="disease",
            stage="model_load",
            model_path=str(model_path),
        )
        class_map_start = monotonic()
        log_event(
            logger,
            "class_map_load_begin",
            start=class_map_start,
            task="disease",
            stage="model_load",
            class_map_path=str(class_map_path),
        )
        class_map = load_class_map(class_map_path)
        log_event(
            logger,
            "class_map_load_end",
            start=class_map_start,
            task="disease",
            stage="model_load",
            class_count=len(class_map),
        )
        self.index_to_class = {idx: label for label, idx in class_map.items()}
        self.image_size = image_size
        self.top_k = top_k
        log_event(
            logger,
            "disease_predictor_ready",
            start=init_start,
            task="disease",
            stage="model_load",
            image_size=image_size,
            top_k=top_k,
        )

    def _preprocess(self, image_bytes: bytes) -> np.ndarray:
        preprocess_start = monotonic()
        log_event(
            logger,
            "image_preprocess_begin",
            start=preprocess_start,
            task="disease",
            stage="preprocess",
            upload_size_bytes=len(image_bytes),
        )
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception as exc:
            log_event(
                logger,
                "invalid_image_upload",
                severity="warning",
                start=preprocess_start,
                task="disease",
                stage="preprocess",
                upload_size_bytes=len(image_bytes),
                exc=exc,
            )
            raise InferenceError("Invalid image payload.") from exc
        image = image.resize(self.image_size)
        arr = np.asarray(image, dtype=np.float32)
        arr = np.expand_dims(arr, axis=0)
        arr = self._tf.keras.applications.mobilenet_v3.preprocess_input(arr)
        log_event(
            logger,
            "image_preprocess_end",
            start=preprocess_start,
            task="disease",
            stage="preprocess",
            tensor_shape=list(arr.shape),
        )
        return arr

    def predict(self, image_bytes: bytes, model_version: str) -> dict[str, object]:
        request_start = monotonic()
        tensor = self._preprocess(image_bytes)
        inference_start = monotonic()
        log_event(logger, "inference_begin", start=inference_start, task="disease", stage="inference")
        try:
            probs = self.model.predict(tensor, verbose=0)[0]
        except Exception as exc:
            log_event(
                logger,
                "inference_failed",
                severity="error",
                start=inference_start,
                task="disease",
                stage="inference",
                exc=exc,
            )
            raise InferenceError(f"Disease inference failed: {exc}") from exc
        top_indices = np.argsort(probs)[::-1][: self.top_k]
        top = [
            {"label": self.index_to_class[int(index)], "confidence": float(probs[int(index)])}
            for index in top_indices
        ]
        primary_label = top[0]["label"]
        crop_type, disease = parse_class_label(primary_label)
        log_event(
            logger,
            "inference_end",
            start=inference_start,
            task="disease",
            stage="inference",
            predicted_class=disease,
            confidence=float(top[0]["confidence"]),
            model_version=model_version,
        )
        log_event(
            logger,
            "prediction_complete",
            start=request_start,
            task="disease",
            stage="response",
            predicted_class=disease,
            confidence=float(top[0]["confidence"]),
            model_version=model_version,
        )
        return {
            "crop_type": crop_type,
            "disease": disease,
            "confidence": float(top[0]["confidence"]),
            "top_3": top,
            "model_version": model_version,
        }
