"""Safe retraining pipeline."""

from __future__ import annotations

import argparse
from typing import Any

from src.core.config import ConfigLoader
from src.core.hashing import hash_dataframe, hash_directory
from src.ingestion.price_loader import load_price_dataset
from src.ingestion.yield_loader import load_yield_dataset
from src.pipelines.training_pipeline import run_training
from src.registry.model_registry import ModelRegistry


def _dataset_hash_for_task(task: str, config: dict[str, Any]) -> str:
    paths = config["paths"]
    if task == "yield":
        df = load_yield_dataset(paths["raw"]["yield"], paths["schemas"]["yield"])
        return hash_dataframe(df)
    if task == "price":
        df = load_price_dataset(paths["raw"]["price"], paths["schemas"]["price"])
        return hash_dataframe(df)
    if task == "disease":
        return hash_directory(paths["raw"]["disease_images"], suffixes=(".jpg", ".jpeg", ".png", ".bmp", ".webp"))
    raise ValueError(f"Unsupported task '{task}'.")


def run_retraining(task: str, training_config_path: str, retraining_config_path: str) -> list[dict[str, Any]]:
    loader = ConfigLoader()
    training_config = loader.load_training_config(training_config_path)
    retraining_config = loader.load_retraining_config(retraining_config_path)["retraining"]
    registry = ModelRegistry(
        registry_path=training_config["paths"]["registry"]["metadata_json"],
        schema_path=training_config["paths"]["schemas"]["registry"],
        config=training_config,
    )

    selected_tasks = ["yield", "price", "disease"] if task == "all" else [task]
    outcomes: list[dict[str, Any]] = []
    for selected in selected_tasks:
        current_hash = _dataset_hash_for_task(selected, training_config)
        production = registry.get_production(selected)
        if bool(retraining_config["skip_if_hash_unchanged"]) and production is not None:
            if production.get("dataset_hash") == current_hash:
                outcomes.append({"task": selected, "status": "skipped_hash_unchanged"})
                continue
        result = run_training(task=selected, config_path=training_config_path)
        outcomes.extend(result)
    return outcomes


def main() -> None:
    parser = argparse.ArgumentParser(description="FarmCast retraining pipeline")
    parser.add_argument("--task", required=True, choices=["yield", "price", "disease", "all"])
    parser.add_argument("--training-config", required=True)
    parser.add_argument("--retraining-config", required=True)
    args = parser.parse_args()
    run_retraining(
        task=args.task,
        training_config_path=args.training_config,
        retraining_config_path=args.retraining_config,
    )


if __name__ == "__main__":
    main()
