"""Training pipeline orchestrator."""

from __future__ import annotations

import argparse
from importlib import import_module
from pathlib import Path
from typing import Any

from src.core.config import ConfigLoader
from src.core.deterministic import set_global_determinism
from src.core.hashing import hash_dataframe
from src.core.logging import get_logger, log_event
from src.features.persistence import save_object
from src.features.price_feature_builder import build_price_features
from src.features.yield_feature_builder import build_yield_features
from src.ingestion.price_loader import load_price_dataset
from src.ingestion.yield_loader import load_yield_dataset
from src.models.disease.dataset_builder import build_disease_dataset
from src.models.disease.evaluator import enforce_disease_thresholds
from src.models.disease.trainer import train_disease_model
from src.models.disease.utils import save_class_map
from src.models.price.evaluator import enforce_price_thresholds
from src.models.price.trainer import train_price_model
from src.models.price.utils import build_feature_columns as build_price_feature_columns
from src.pipelines.utils import benchmark_latency, ensure_dir, promote_artifact, write_json
from src.registry.metadata_manager import ModelMetadata
from src.registry.model_registry import ModelRegistry


_yield_evaluator = import_module("src.models.yield.evaluator")
_yield_trainer = import_module("src.models.yield.trainer")
_yield_utils = import_module("src.models.yield.utils")
enforce_yield_thresholds = _yield_evaluator.enforce_yield_thresholds
train_yield_model = _yield_trainer.train_yield_model
build_yield_feature_columns = _yield_utils.build_feature_columns


def _snapshot_config(config: dict[str, Any]) -> dict[str, Any]:
    return ConfigLoader().snapshot(config)


def _stage_banner(logger, title: str) -> None:
    logger.info("=" * 60)
    logger.info(f"PIPELINE STAGE: {title}")
    logger.info("=" * 60)


def _register_and_promote(
    task: str,
    metadata: ModelMetadata,
    registry: ModelRegistry,
    production_artifacts: list[tuple[Path, Path]],
    logger,
) -> dict[str, Any]:
    candidate = registry.register_candidate(task, metadata.to_dict())
    promoted = False
    if registry.should_promote(task, candidate["metrics"]):
        registry.promote(task, candidate["version"])
        for src, dest in production_artifacts:
            promote_artifact(src, dest)
        promoted = True
    log_event(logger, "registry", "candidate_registered", task=task, version=candidate["version"], promoted=promoted)
    return {"version": candidate["version"], "promoted": promoted}


def _train_yield(config: dict[str, Any], registry: ModelRegistry, logger) -> dict[str, Any]:
    _stage_banner(logger, "DATASET BUILD")

    paths = config["paths"]
    yield_df = load_yield_dataset(paths["raw"]["yield"], paths["schemas"]["yield"])
    dataset_hash = hash_dataframe(yield_df)
    feature_df = build_yield_features(yield_df, config)

    _stage_banner(logger, "MODEL TRAINING")

    result = train_yield_model(feature_df, config)
    enforce_yield_thresholds(result.metrics, config["yield"]["thresholds"])

    logger.info("Evaluation metrics:")
    logger.info(result.metrics)

    version = registry.next_version("yield")
    staging_dir = ensure_dir(Path(paths["models"]["yield_staging"]) / version)
    model_path = save_object(result.model, staging_dir / "model.joblib")
    preprocessor_path = save_object(result.preprocessor, staging_dir / "preprocessor.joblib")
    metadata_path = write_json(
        staging_dir / "metadata.json",
        {"version": version, "metrics": result.metrics, "residual_std": result.residual_std, "dataset_hash": dataset_hash},
    )

    feature_columns, _, _ = build_yield_feature_columns(config)
    sample = feature_df.iloc[[0]][feature_columns]
    latency_ms = benchmark_latency(
        lambda: result.model.predict(result.preprocessor.transform(sample)),
        iterations=int(config["registry"]["latency_benchmark"]["iterations"]),
    )

    metadata = ModelMetadata(
        model_name="yield",
        version=version,
        timestamp_utc=ModelMetadata.now_iso(),
        dataset_hash=dataset_hash,
        metrics={key: float(value) for key, value in result.metrics.items()},
        config_snapshot=_snapshot_config(config),
        latency_benchmark_ms=latency_ms,
        artifact_path=str(staging_dir),
        stage="staging",
    )
    production_dir = ensure_dir(paths["models"]["yield_production"])
    registry_result = _register_and_promote(
        task="yield",
        metadata=metadata,
        registry=registry,
        production_artifacts=[
            (Path(model_path), production_dir / "model.joblib"),
            (Path(preprocessor_path), production_dir / "preprocessor.joblib"),
            (Path(metadata_path), production_dir / "metadata.json"),
        ],
        logger=logger,
    )
    return {"task": "yield", "metrics": result.metrics, **registry_result}


def _train_price(config: dict[str, Any], registry: ModelRegistry, logger) -> dict[str, Any]:
    _stage_banner(logger, "DATASET BUILD")

    paths = config["paths"]
    price_df = load_price_dataset(paths["raw"]["price"], paths["schemas"]["price"])
    dataset_hash = hash_dataframe(price_df)
    feature_df = build_price_features(price_df, config)

    _stage_banner(logger, "MODEL TRAINING")

    result = train_price_model(feature_df, config)
    enforce_price_thresholds(result.metrics, config["price"]["thresholds"])

    logger.info("Evaluation metrics:")
    logger.info(result.metrics)

    version = registry.next_version("price")
    staging_dir = ensure_dir(Path(paths["models"]["price_staging"]) / version)
    model_path = save_object(result.model, staging_dir / "model.joblib")
    preprocessor_path = save_object(result.preprocessor, staging_dir / "preprocessor.joblib")
    metadata_path = write_json(
        staging_dir / "metadata.json",
        {"version": version, "metrics": result.metrics, "residual_std": result.residual_std, "dataset_hash": dataset_hash},
    )

    feature_columns, _, _ = build_price_feature_columns(config)
    sample = feature_df.iloc[[0]][feature_columns]
    latency_ms = benchmark_latency(
        lambda: result.model.predict(result.preprocessor.transform(sample)),
        iterations=int(config["registry"]["latency_benchmark"]["iterations"]),
    )

    metadata = ModelMetadata(
        model_name="price",
        version=version,
        timestamp_utc=ModelMetadata.now_iso(),
        dataset_hash=dataset_hash,
        metrics={key: float(value) for key, value in result.metrics.items()},
        config_snapshot=_snapshot_config(config),
        latency_benchmark_ms=latency_ms,
        artifact_path=str(staging_dir),
        stage="staging",
    )
    production_dir = ensure_dir(paths["models"]["price_production"])
    registry_result = _register_and_promote(
        task="price",
        metadata=metadata,
        registry=registry,
        production_artifacts=[
            (Path(model_path), production_dir / "model.joblib"),
            (Path(preprocessor_path), production_dir / "preprocessor.joblib"),
            (Path(metadata_path), production_dir / "metadata.json"),
        ],
        logger=logger,
    )
    return {"task": "price", "metrics": result.metrics, **registry_result}


def _train_disease(config: dict[str, Any], registry: ModelRegistry, logger) -> dict[str, Any]:
    _stage_banner(logger, "DATASET BUILD")

    paths = config["paths"]
    disease_cfg = config["disease"]

    bundle = build_disease_dataset(
        root_dir=paths["raw"]["disease_images"],
        min_images_per_class=int(disease_cfg["min_images_per_class"]),
        max_corrupted_images=int(disease_cfg["max_corrupted_images"]),
        train_fraction=float(disease_cfg["train_fraction"]),
        seed=int(config["runtime"]["random_seed"]),
    )

    _stage_banner(logger, "MODEL TRAINING")

    version = registry.next_version("disease")
    staging_dir = ensure_dir(Path(paths["models"]["disease_staging"]) / version)

    result = train_disease_model(bundle=bundle, config=config, checkpoint_path=str(staging_dir / "checkpoint.keras"))
    enforce_disease_thresholds(result.metrics, disease_cfg["thresholds"])

    logger.info("Evaluation metrics:")
    logger.info(result.metrics)

    model_path = staging_dir / "model.keras"
    result.model.save(model_path)
    class_map_path = save_class_map(staging_dir / "class_map.json", bundle.class_to_index)
    metadata_path = write_json(
        staging_dir / "metadata.json",
        {
            "version": version,
            "metrics": result.metrics,
            "class_counts": bundle.class_counts,
            "corrupted_images": bundle.corrupted_images,
            "dataset_hash": bundle.dataset_hash,
        },
    )

    try:
        import tensorflow as tf  # type: ignore

        sample = tf.zeros(shape=(1, disease_cfg["image_size"][0], disease_cfg["image_size"][1], 3), dtype=tf.float32)
        latency_ms = benchmark_latency(
            lambda: result.model.predict(sample, verbose=0),
            iterations=int(config["registry"]["latency_benchmark"]["iterations"]),
        )
    except Exception:
        latency_ms = 0.0

    metadata = ModelMetadata(
        model_name="disease",
        version=version,
        timestamp_utc=ModelMetadata.now_iso(),
        dataset_hash=bundle.dataset_hash,
        metrics={key: float(value) for key, value in result.metrics.items() if key != "confusion_matrix"},
        config_snapshot=_snapshot_config(config),
        latency_benchmark_ms=latency_ms,
        artifact_path=str(staging_dir),
        stage="staging",
    )
    production_dir = ensure_dir(paths["models"]["disease_production"])
    registry_result = _register_and_promote(
        task="disease",
        metadata=metadata,
        registry=registry,
        production_artifacts=[
            (Path(model_path), production_dir / "model.keras"),
            (Path(class_map_path), production_dir / "class_map.json"),
            (Path(metadata_path), production_dir / "metadata.json"),
        ],
        logger=logger,
    )
    return {"task": "disease", "metrics": result.metrics, **registry_result}


def run_training(task: str, config_path: str) -> list[dict[str, Any]]:
    loader = ConfigLoader()
    config = loader.load_training_config(config_path)
    seed = int(config["runtime"]["random_seed"])
    set_global_determinism(seed=seed, python_hash_seed=str(config["runtime"]["python_hash_seed"]))

    logger = get_logger("farmcast.training")
    log_event(logger, "training", "start", task=task)

    registry = ModelRegistry(
        registry_path=config["paths"]["registry"]["metadata_json"],
        schema_path=config["paths"]["schemas"]["registry"],
        config=config,
    )

    selected_tasks = ["yield", "price", "disease"] if task == "all" else [task]
    outcomes: list[dict[str, Any]] = []

    for selected in selected_tasks:
        if selected == "yield":
            outcomes.append(_train_yield(config, registry, logger))
        elif selected == "price":
            outcomes.append(_train_price(config, registry, logger))
        elif selected == "disease":
            outcomes.append(_train_disease(config, registry, logger))
        else:
            raise ValueError(f"Unsupported task '{selected}'.")

    log_event(logger, "training", "complete", task=task, runs=len(outcomes))
    return outcomes


def main() -> None:
    parser = argparse.ArgumentParser(description="FarmCast training pipeline")
    parser.add_argument("--task", required=True, choices=["yield", "price", "disease", "all"])
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    run_training(task=args.task, config_path=args.config)


if __name__ == "__main__":
    main()
