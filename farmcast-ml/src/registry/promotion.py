"""Promotion scoring and metric comparison."""

from __future__ import annotations

from typing import Any

from src.core.exceptions import PromotionError


def is_better(new_metrics: dict[str, float], current_metrics: dict[str, float], objectives: dict[str, str]) -> bool:
    if not objectives:
        raise PromotionError("Promotion objectives are required.")

    strict_improvement = False
    for metric, direction in objectives.items():
        if metric not in new_metrics:
            raise PromotionError(f"Missing metric in candidate: {metric}")
        if metric not in current_metrics:
            raise PromotionError(f"Missing metric in baseline: {metric}")
        new_value = float(new_metrics[metric])
        current_value = float(current_metrics[metric])
        if direction == "max":
            if new_value < current_value:
                return False
            if new_value > current_value:
                strict_improvement = True
        elif direction == "min":
            if new_value > current_value:
                return False
            if new_value < current_value:
                strict_improvement = True
        else:
            raise PromotionError(f"Unsupported objective direction '{direction}' for metric '{metric}'.")
    return strict_improvement


def resolve_objectives(config: dict[str, Any], task: str) -> dict[str, str]:
    objectives = config["registry"]["promotion"]["objectives"]
    if task not in objectives:
        raise PromotionError(f"Promotion objectives missing for task '{task}'.")
    task_objectives = objectives[task]
    if not isinstance(task_objectives, dict):
        raise PromotionError(f"Objectives for task '{task}' must be mapping.")
    return {str(metric): str(direction) for metric, direction in task_objectives.items()}
