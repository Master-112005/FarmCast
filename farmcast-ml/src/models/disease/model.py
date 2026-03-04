"""Disease model architecture."""

from __future__ import annotations

from typing import Any

from src.core.augmentation import build_augmentation_layer
from src.core.losses import weighted_categorical_crossentropy
from src.core.logging import get_logger


# =====================================================
# LOGGER
# =====================================================
logger = get_logger(__name__)


def build_disease_model(num_classes: int, class_weights: list[float], config: dict[str, Any], seed: int):
    try:
        import tensorflow as tf  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise ImportError("TensorFlow is required for disease model.") from exc

    disease_cfg = config["disease"]
    image_height, image_width = disease_cfg["image_size"]
    learning_rate = float(disease_cfg["optimizer"]["learning_rate"])
    trainable_fraction = float(disease_cfg["backbone_trainable_fraction"])

    # =====================================================
    # INPUT + AUGMENTATION
    # =====================================================
    inputs = tf.keras.Input(shape=(image_height, image_width, 3), name="image")
    augmentation = build_augmentation_layer(seed)
    x = augmentation(inputs)
    x = tf.keras.applications.mobilenet_v3.preprocess_input(x)

    # =====================================================
    # BACKBONE BUILD
    # =====================================================
    logger.info("Building MobileNetV3-Large backbone...")

    backbone = tf.keras.applications.MobileNetV3Large(
        include_top=False,
        weights="imagenet",
        input_shape=(image_height, image_width, 3),
    )

    total_layers = len(backbone.layers)
    frozen_layers = int(total_layers * (1.0 - trainable_fraction))

    for idx, layer in enumerate(backbone.layers):
        layer.trainable = idx >= frozen_layers

    logger.info(f"Backbone layers: {total_layers}")
    logger.info(f"Frozen layers: {frozen_layers}")
    logger.info(f"Trainable layers: {total_layers - frozen_layers}")

    # =====================================================
    # HEAD
    # =====================================================
    x = backbone(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.2)(x)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax", name="disease_logits")(x)

    model = tf.keras.Model(inputs=inputs, outputs=outputs, name="farmcast_disease_mobilenetv3")

    # =====================================================
    # COMPILE
    # =====================================================
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss=weighted_categorical_crossentropy(class_weights),
        metrics=[
            tf.keras.metrics.CategoricalAccuracy(name="accuracy"),
            tf.keras.metrics.Recall(name="recall"),
        ],
    )

    # 🔥 PROFESSIONAL LOGGING
    logger.info("Model compiled successfully.")
    logger.info(f"Total parameters: {model.count_params():,}")

    return model
