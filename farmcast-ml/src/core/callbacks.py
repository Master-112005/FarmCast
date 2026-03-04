"""Training callback factories."""

from __future__ import annotations

from pathlib import Path


def build_tf_callbacks(checkpoint_path: str | Path, patience: int, min_lr: float = 1.0e-6) -> list:
    try:
        import tensorflow as tf  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise ImportError("TensorFlow is required for disease callbacks.") from exc

    path = Path(checkpoint_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    return [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=patience,
            restore_best_weights=True,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=max(1, patience // 2),
            min_lr=min_lr,
        ),
        tf.keras.callbacks.ModelCheckpoint(
            filepath=str(path),
            monitor="val_loss",
            save_best_only=True,
        ),
    ]
