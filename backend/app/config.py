from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


# با این مسیر، اجرای API از هر پوشه‌ای انجام شود باز هم ریشه پروژه درست پیدا می‌شود.
PROJECT_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    dataset_path: Path
    cors_origins: tuple[str, ...] = ("http://localhost:3000",)


def get_settings() -> Settings:
    # این متغیر محیطی اجازه می‌دهد هنگام توسعه، CSV دیگری را بدون تغییر کد انتخاب کنیم.
    configured_path = os.getenv("SUPERSTORE_DATASET_PATH", "dataset/superstore-sales.csv")
    dataset_path = Path(configured_path)
    if not dataset_path.is_absolute():
        dataset_path = PROJECT_ROOT / dataset_path
    return Settings(dataset_path=dataset_path.resolve())
