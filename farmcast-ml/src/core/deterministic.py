"""Deterministic runtime helpers."""

from __future__ import annotations

import os
import random
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class DeterminismConfig:
    seed: int
    python_hash_seed: str


def set_global_determinism(seed: int, python_hash_seed: str) -> DeterminismConfig:
    os.environ["PYTHONHASHSEED"] = python_hash_seed
    os.environ["TF_DETERMINISTIC_OPS"] = "1"
    os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":16:8"

    random.seed(seed)
    np.random.seed(seed)

    try:
        import tensorflow as tf  # type: ignore

        tf.random.set_seed(seed)
        try:
            tf.config.experimental.enable_op_determinism()
        except Exception:
            pass
    except Exception:
        pass

    return DeterminismConfig(seed=seed, python_hash_seed=python_hash_seed)
