"""Yield training workflow."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from src.core.metrics import regression_metrics
from .model import build_yield_regressor
from .utils import (
    build_feature_columns,
    build_preprocessor,
    extract_xy,
    time_aware_split,
    validate_min_rows,
)


@dataclass
class YieldTrainingResult:
    model: Any
    preprocessor: Any
    metrics: dict[str, float]
    best_params: dict[str, Any]
    residual_std: float


def _train_once(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    feature_columns: list[str],
    categorical_features: list[str],
    numerical_features: list[str],
    target_column: str,
    params: dict[str, Any],
    seed: int,
    early_stopping_rounds: int,
) -> tuple[Any, Any, dict[str, float], np.ndarray, np.ndarray]:
    preprocessor = build_preprocessor(categorical_features, numerical_features)
    x_train, y_train = extract_xy(train_df, feature_columns, target_column)
    x_val, y_val = extract_xy(val_df, feature_columns, target_column)

    x_train_t = preprocessor.fit_transform(x_train)
    x_val_t = preprocessor.transform(x_val)

    regressor = build_yield_regressor(params, seed=seed)
    try:
        import lightgbm as lgb
    except Exception as exc:  # pragma: no cover
        raise ImportError("lightgbm is required for yield training.") from exc

    regressor.fit(
        x_train_t,
        y_train,
        eval_set=[(x_val_t, y_val)],
        callbacks=[lgb.early_stopping(stopping_rounds=early_stopping_rounds, verbose=False)],
    )

    y_pred = regressor.predict(x_val_t)
    metrics = regression_metrics(np.asarray(y_val), np.asarray(y_pred))
    return regressor, preprocessor, metrics, np.asarray(y_val), np.asarray(y_pred)


def _run_optuna_if_enabled(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    feature_columns: list[str],
    categorical_features: list[str],
    numerical_features: list[str],
    section: dict[str, Any],
    seed: int,
) -> dict[str, Any]:
    base_params = dict(section["lightgbm"])
    optuna_cfg = section["optuna"]
    if not bool(optuna_cfg["enabled"]):
        return base_params
    try:
        import optuna
    except Exception as exc:  # pragma: no cover
        raise ImportError("optuna is required when yield optuna.enabled is true.") from exc

    target_column = section["target_column"]
    early_stopping_rounds = int(section["early_stopping_rounds"])
    sampler = optuna.samplers.TPESampler(seed=seed)
    study = optuna.create_study(direction="minimize", sampler=sampler)

    def objective(trial: optuna.trial.Trial) -> float:
        trial_params = dict(base_params)
        trial_params.update(
            {
                "num_leaves": trial.suggest_int("num_leaves", 16, 128),
                "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
                "n_estimators": trial.suggest_int("n_estimators", 200, 1000),
                "subsample": trial.suggest_float("subsample", 0.6, 1.0),
                "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
                "reg_lambda": trial.suggest_float("reg_lambda", 1.0e-3, 10.0, log=True),
                "min_child_samples": trial.suggest_int("min_child_samples", 5, 50),
            }
        )
        _, _, metrics, _, _ = _train_once(
            train_df=train_df,
            val_df=val_df,
            feature_columns=feature_columns,
            categorical_features=categorical_features,
            numerical_features=numerical_features,
            target_column=target_column,
            params=trial_params,
            seed=seed,
            early_stopping_rounds=early_stopping_rounds,
        )
        return float(metrics["mae"])

    study.optimize(
        objective,
        n_trials=int(optuna_cfg["n_trials"]),
        timeout=int(optuna_cfg["timeout_seconds"]),
        gc_after_trial=True,
        show_progress_bar=False,
    )

    if study.best_trial is None:
        return base_params

    tuned = dict(base_params)
    tuned.update(study.best_trial.params)
    return tuned


def train_yield_model(df: pd.DataFrame, config: dict[str, Any]) -> YieldTrainingResult:
    section = config["yield"]
    runtime_seed = int(config["runtime"]["random_seed"])
    validate_min_rows(df, min_rows=int(section["min_rows"]))

    split = time_aware_split(
        df=df,
        time_column=section["time_column"],
        train_fraction=float(section["train_fraction"]),
    )
    feature_columns, categorical_features, numerical_features = build_feature_columns(config)
    best_params = _run_optuna_if_enabled(
        train_df=split.train_df,
        val_df=split.val_df,
        feature_columns=feature_columns,
        categorical_features=categorical_features,
        numerical_features=numerical_features,
        section=section,
        seed=runtime_seed,
    )

    model, preprocessor, metrics, y_true, y_pred = _train_once(
        train_df=split.train_df,
        val_df=split.val_df,
        feature_columns=feature_columns,
        categorical_features=categorical_features,
        numerical_features=numerical_features,
        target_column=section["target_column"],
        params=best_params,
        seed=runtime_seed,
        early_stopping_rounds=int(section["early_stopping_rounds"]),
    )

    residual_std = float(np.std(y_true - y_pred))
    return YieldTrainingResult(
        model=model,
        preprocessor=preprocessor,
        metrics=metrics,
        best_params=best_params,
        residual_std=residual_std,
    )
