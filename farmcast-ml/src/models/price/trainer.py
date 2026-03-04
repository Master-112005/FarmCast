"""Price training workflow."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from src.core.metrics import regression_metrics
from src.models.price.model import build_price_regressor
from src.models.price.utils import (
    build_feature_columns,
    build_preprocessor,
    extract_xy,
    sequential_split,
    validate_min_rows,
)


@dataclass
class PriceTrainingResult:
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

    regressor = build_price_regressor(params, seed=seed)
    try:
        import lightgbm as lgb
    except Exception as exc:  # pragma: no cover
        raise ImportError("lightgbm is required for price training.") from exc

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
        raise ImportError("optuna is required when price optuna.enabled is true.") from exc

    target_column = section["target_column"]
    early_stopping_rounds = int(section["early_stopping_rounds"])
    sampler = optuna.samplers.TPESampler(seed=seed)
    study = optuna.create_study(direction="minimize", sampler=sampler)

    def objective(trial: optuna.trial.Trial) -> float:
        trial_params = dict(base_params)
        trial_params.update(
            {
                "num_leaves": trial.suggest_int("num_leaves", 8, 96),
                "learning_rate": trial.suggest_float("learning_rate", 0.005, 0.1, log=True),
                "n_estimators": trial.suggest_int("n_estimators", 200, 900),
                "subsample": trial.suggest_float("subsample", 0.6, 1.0),
                "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
                "reg_lambda": trial.suggest_float("reg_lambda", 1.0e-3, 10.0, log=True),
                "min_child_samples": trial.suggest_int("min_child_samples", 3, 30),
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
        return float(metrics["mape"])

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


def train_price_model(df: pd.DataFrame, config: dict[str, Any]) -> PriceTrainingResult:
    section = config["price"]
    runtime_seed = int(config["runtime"]["random_seed"])
    validate_min_rows(df, min_rows=int(section["min_rows"]))

    split = sequential_split(
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
    return PriceTrainingResult(
        model=model,
        preprocessor=preprocessor,
        metrics=metrics,
        best_params=best_params,
        residual_std=residual_std,
    )
