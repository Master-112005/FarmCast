"""Deterministic image augmentation for disease model."""

from __future__ import annotations


def build_augmentation_layer(seed: int):
    try:
        import tensorflow as tf
    except Exception as exc:
        raise ImportError("TensorFlow is required for augmentation.") from exc

    return tf.keras.Sequential(
        [
            tf.keras.layers.RandomFlip("horizontal", seed=seed),
            tf.keras.layers.RandomRotation(0.05, seed=seed),
            tf.keras.layers.RandomZoom(0.1, seed=seed),
            tf.keras.layers.RandomContrast(0.1, seed=seed),
        ],
        name="disease_augmentation",
    )
