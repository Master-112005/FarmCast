"""Disease training workflow."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import time

from src.core.callbacks import build_tf_callbacks
from src.models.disease.evaluator import evaluate_disease_predictions
from src.models.disease.model import build_disease_model
from src.models.disease.utils import compute_class_weights
from src.core.logging import get_logger


logger = get_logger(__name__)


@dataclass
class DiseaseTrainingResult:
    model: Any
    metrics: dict[str, object]
    history: dict[str, list[float]]
    class_weights: list[float]


def _build_tf_dataset(
    paths: list[str],
    labels: list[int],
    image_size: tuple[int, int],
    num_classes: int,
    batch_size: int,
    seed: int,
    shuffle: bool,
):
    try:
        import tensorflow as tf  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise ImportError("TensorFlow is required for disease training.") from exc

    path_ds = tf.data.Dataset.from_tensor_slices(paths)
    label_ds = tf.data.Dataset.from_tensor_slices(labels)
    ds = tf.data.Dataset.zip((path_ds, label_ds))

    def _load(path, label):  # type: ignore[no-untyped-def]
        raw = tf.io.read_file(path)
        image = tf.image.decode_image(raw, channels=3, expand_animations=False)
        image = tf.image.resize(image, image_size)
        image = tf.cast(image, tf.float32)
        encoded = tf.one_hot(label, depth=num_classes)
        return image, encoded

    ds = ds.map(_load, num_parallel_calls=tf.data.AUTOTUNE)
    if shuffle:
        ds = ds.shuffle(
            buffer_size=max(batch_size * 8, 128),
            seed=seed,
            reshuffle_each_iteration=False,
        )
    ds = ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)
    return ds


def train_disease_model(bundle: Any, config: dict[str, Any], checkpoint_path: str) -> DiseaseTrainingResult:
    try:
        import tensorflow as tf  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise ImportError("TensorFlow is required for disease training.") from exc

    disease_cfg = config["disease"]
    seed = int(config["runtime"]["random_seed"])
    image_size = tuple(disease_cfg["image_size"])
    batch_size = int(disease_cfg["batch_size"])
    epochs = int(disease_cfg["epochs"])
    num_classes = len(bundle.class_to_index)

    logger.info("Starting model training...")
    logger.info(f"Epochs: {epochs}")
    logger.info(f"Batch size: {batch_size}")
    logger.info(f"Number of classes: {num_classes}")

    if bool(disease_cfg["mixed_precision"]) and tf.config.list_physical_devices("GPU"):
        logger.info("Mixed precision enabled.")
        tf.keras.mixed_precision.set_global_policy("mixed_float16")

    class_weights = compute_class_weights(bundle.train_labels, num_classes)

    model = build_disease_model(
        num_classes=num_classes,
        class_weights=class_weights,
        config=config,
        seed=seed,
    )

    train_ds = _build_tf_dataset(
        paths=bundle.train_paths,
        labels=bundle.train_labels,
        image_size=image_size,
        num_classes=num_classes,
        batch_size=batch_size,
        seed=seed,
        shuffle=True,
    )

    val_ds = _build_tf_dataset(
        paths=bundle.val_paths,
        labels=bundle.val_labels,
        image_size=image_size,
        num_classes=num_classes,
        batch_size=batch_size,
        seed=seed,
        shuffle=False,
    )

    callbacks = build_tf_callbacks(checkpoint_path=checkpoint_path, patience=5)

    logger.info("Beginning training loop...")
    start_time = time.time()

    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=epochs,
        callbacks=callbacks,
        verbose=1,  # 🔥 REQUIRED CHANGE
    )

    elapsed = time.time() - start_time
    logger.info(f"Training completed in {elapsed:.2f} seconds.")

    logger.info("Running evaluation on validation dataset...")

    predictions = model.predict(val_ds, verbose=0)
    predicted_labels = np.argmax(predictions, axis=1)
    true_labels = np.asarray(bundle.val_labels, dtype=np.int64)

    metrics = evaluate_disease_predictions(
        y_true=true_labels,
        y_pred=predicted_labels,
        class_labels=list(range(num_classes)),
    )

    logger.info("Evaluation complete.")
    logger.info(metrics)

    return DiseaseTrainingResult(
        model=model,
        metrics=metrics,
        history={key: [float(x) for x in values] for key, values in history.history.items()},
        class_weights=class_weights,
    )
