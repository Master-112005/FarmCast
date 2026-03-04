"""Loss factories for ML models."""

from __future__ import annotations

from typing import Callable

import numpy as np


def weighted_categorical_crossentropy(class_weights: list[float]) -> Callable:
    """Return a TensorFlow-compatible weighted categorical loss."""
    try:
        import tensorflow as tf  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise ImportError("TensorFlow is required for disease losses.") from exc

    weight_tensor = tf.constant(np.asarray(class_weights, dtype=np.float32))

    def loss(y_true, y_pred):  # type: ignore[no-untyped-def]
        y_pred = tf.clip_by_value(y_pred, tf.keras.backend.epsilon(), 1.0 - tf.keras.backend.epsilon())
        per_class = -y_true * tf.math.log(y_pred) * weight_tensor
        return tf.reduce_sum(per_class, axis=-1)

    return loss
