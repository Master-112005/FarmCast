from __future__ import annotations

from pathlib import Path

from PIL import Image
import pytest

from src.core.exceptions import TrainingAbortError
from src.models.disease.dataset_builder import build_disease_dataset


def _write_image(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGB", (8, 8), color=(100, 150, 200))
    image.save(path)


def test_disease_dataset_builder_success(tmp_path: Path) -> None:
    for idx in range(4):
        _write_image(tmp_path / "rice__healthy" / f"h_{idx}.png")
        _write_image(tmp_path / "rice__blast" / f"b_{idx}.png")

    bundle = build_disease_dataset(
        root_dir=tmp_path,
        min_images_per_class=2,
        max_corrupted_images=1,
        train_fraction=0.75,
        seed=42,
    )
    assert set(bundle.class_counts) == {"rice__blast", "rice__healthy"}
    assert len(bundle.train_paths) > len(bundle.val_paths)


def test_disease_dataset_builder_fails_on_corrupted_limit(tmp_path: Path) -> None:
    class_dir = tmp_path / "rice__healthy"
    class_dir.mkdir(parents=True, exist_ok=True)
    for idx in range(2):
        _write_image(class_dir / f"ok_{idx}.png")
    (class_dir / "broken.png").write_bytes(b"not-an-image")

    with pytest.raises(TrainingAbortError):
        build_disease_dataset(
            root_dir=tmp_path,
            min_images_per_class=2,
            max_corrupted_images=0,
            train_fraction=0.8,
            seed=42,
        )
