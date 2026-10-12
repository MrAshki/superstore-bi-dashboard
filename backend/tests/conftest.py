from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app.config import get_settings
from backend.app.data_loader import DatasetStore, load_dataset
from backend.app.main import app


@pytest.fixture(scope="session")
def store() -> DatasetStore:
    # همه آزمون‌های تحلیل از یک نسخه فقط‌خواندنی از dataset استفاده می‌کنند.
    return load_dataset(get_settings().dataset_path)


@pytest.fixture()
def client():
    # TestClient چرخه startup FastAPI را اجرا می‌کند؛ بنابراین loading واقعی CSV هم آزمون می‌شود.
    with TestClient(app) as test_client:
        yield test_client
