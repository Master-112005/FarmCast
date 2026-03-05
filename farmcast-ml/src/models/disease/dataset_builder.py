"""Disease dataset construction and validation."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from collections import Counter

from PIL import Image
from sklearn.model_selection import train_test_split

from src.core.exceptions import DatasetValidationError, TrainingAbortError
from src.core.hashing import hash_directory
from src.core.logging import get_logger


logger = get_logger(__name__)

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


@dataclass(frozen=True)
class DiseaseDatasetBundle:
    train_paths: list[str]
    train_labels: list[int]
    val_paths: list[str]
    val_labels: list[int]
    class_to_index: dict[str, int]
    class_counts: dict[str, int]
    corrupted_images: int
    dataset_hash: str


def _is_valid_image(path: Path) -> bool:
    try:
        with Image.open(path) as image:
            image.verify()
        return True
    except Exception:
        return False


def _normalize_token(value: str) -> str:
    token = value.strip().lower()
    token = re.sub(r"[^a-z0-9]+", "_", token)
    token = re.sub(r"_+", "_", token)
    return token.strip("_")


def _disease_part(raw_name: str) -> str:
    if "__" in raw_name:
        return raw_name.split("__", 1)[1]
    return raw_name


def _normalize_class_label(raw_name: str) -> str:
    if "__" in raw_name:
        crop_part, disease_part = raw_name.split("__", 1)
        return f"{_normalize_token(crop_part)}__{_normalize_token(disease_part)}"
    return _normalize_token(raw_name)


def _collect_class_dirs(dataset_root: Path) -> list[tuple[str, Path]]:
    top_level = sorted([path for path in dataset_root.iterdir() if path.is_dir()])
    if not top_level:
        return []

    # Try two-level structure: crop directory -> disease class directory.
    nested: list[tuple[str, Path]] = []
    for crop_dir in top_level:
        for class_dir in sorted([path for path in crop_dir.rglob("*") if path.is_dir()]):
            has_images = any(
                file.suffix.lower() in SUPPORTED_EXTENSIONS
                for file in class_dir.iterdir()
                if file.is_file()
            )
            if has_images:
                crop = _normalize_token(crop_dir.name)
                disease = _normalize_token(_disease_part(class_dir.name))
                label = f"{crop}__{disease}"
                nested.append((label, class_dir))

    if nested:
        return nested

    # Fallback to flat class directories.
    flat: list[tuple[str, Path]] = []
    for class_dir in top_level:
        has_images = any(
            file.suffix.lower() in SUPPORTED_EXTENSIONS
            for file in class_dir.rglob("*")
            if file.is_file()
        )
        if has_images:
            flat.append((_normalize_class_label(class_dir.name), class_dir))
    return flat


def build_disease_dataset(
    root_dir: str | Path,
    min_images_per_class: int,
    max_corrupted_images: int,
    train_fraction: float,
    seed: int,
) -> DiseaseDatasetBundle:
    dataset_root = Path(root_dir)
    if not dataset_root.exists():
        raise DatasetValidationError(f"Disease dataset root not found: {dataset_root}")

    # 🔥 LOG: scanning start
    logger.info("Scanning disease image directories...")

    class_entries = _collect_class_dirs(dataset_root)
    if not class_entries:
        raise DatasetValidationError(
            "Disease dataset has no valid class directories with images."
        )

    labels_unique = sorted({label for label, _ in class_entries})
    class_to_index = {label: idx for idx, label in enumerate(labels_unique)}
    class_counts: dict[str, int] = {label: 0 for label in labels_unique}

    # 🔥 LOG: classes detected
    logger.info(f"Detected {len(labels_unique)} classes.")

    paths: list[str] = []
    labels: list[int] = []
    corrupted_count = 0

    for class_label, class_dir in class_entries:
        valid_images = 0
        for file_path in sorted(class_dir.rglob("*")):
            if not file_path.is_file() or file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                continue

            if not _is_valid_image(file_path):
                corrupted_count += 1
                continue

            valid_images += 1
            paths.append(str(file_path))
            labels.append(class_to_index[class_label])

        class_counts[class_label] += valid_images

    total_images = len(paths)

    # 🔥 LOG: image statistics
    logger.info(f"Total images found: {total_images}")
    logger.info(f"Corrupted images detected: {corrupted_count}")

    # Optional Professional Log
    logger.info(f"Class distribution: {Counter(labels)}")

    for class_label, count in class_counts.items():
        if count < min_images_per_class:
            raise TrainingAbortError(
                f"Disease class '{class_label}' has {count} images; minimum required is {min_images_per_class}."
            )

    if corrupted_count > max_corrupted_images:
        raise TrainingAbortError(
            f"Corrupted image count {corrupted_count} exceeds maximum allowed {max_corrupted_images}."
        )

    if len(paths) != len(labels):
        raise DatasetValidationError("Disease dataset path/label mismatch.")

    train_paths, val_paths, train_labels, val_labels = train_test_split(
        paths,
        labels,
        train_size=train_fraction,
        random_state=seed,
        stratify=labels,
        shuffle=True,
    )

    # 🔥 LOG: split statistics
    logger.info(f"Training samples: {len(train_paths)}")
    logger.info(f"Validation samples: {len(val_paths)}")

    dataset_hash = hash_directory(dataset_root, suffixes=tuple(SUPPORTED_EXTENSIONS))

    return DiseaseDatasetBundle(
        train_paths=train_paths,
        train_labels=train_labels,
        val_paths=val_paths,
        val_labels=val_labels,
        class_to_index=class_to_index,
        class_counts=class_counts,
        corrupted_images=corrupted_count,
        dataset_hash=dataset_hash,
    )
