"""Stable hashing helpers for reproducibility tracking."""

from __future__ import annotations

import hashlib
from pathlib import Path

import pandas as pd


def hash_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def hash_file(path: str | Path) -> str:
    file_path = Path(path)
    sha = hashlib.sha256()
    with file_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8192), b""):
            sha.update(chunk)
    return sha.hexdigest()


def hash_dataframe(df: pd.DataFrame) -> str:
    csv_payload = df.sort_index(axis=1).sort_values(by=list(df.columns), kind="stable").to_csv(index=False)
    return hash_bytes(csv_payload.encode("utf-8"))


def hash_directory(path: str | Path, suffixes: tuple[str, ...] | None = None) -> str:
    root = Path(path)
    sha = hashlib.sha256()
    files = sorted([item for item in root.rglob("*") if item.is_file()])
    for file in files:
        if suffixes and file.suffix.lower() not in suffixes:
            continue
        sha.update(str(file.relative_to(root)).encode("utf-8"))
        sha.update(hash_file(file).encode("utf-8"))
    return sha.hexdigest()
