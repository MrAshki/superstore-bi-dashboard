from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, Response

from .analytics import build_dashboard
from .config import get_settings
from .data_loader import DatasetStore, load_dataset
from .filters import FilterValidationError
from .schemas import DashboardFilters, DashboardResponse, MetadataResponse
from .state_codes import get_state_code


@asynccontextmanager
async def lifespan(app: FastAPI):
    # CSV یک‌بار در شروع API خوانده می‌شود تا هر request دوباره فایل را نخواند.
    settings = get_settings()
    app.state.store = load_dataset(settings.dataset_path)
    yield


app = FastAPI(
    title="Superstore BI API",
    version="1.0.0",
    description="Local analytics API for the immutable Superstore CSV dataset.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(get_settings().cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _store(request: Request) -> DatasetStore:
    # routeها همان DataFrame آماده در startup را استفاده می‌کنند.
    return request.app.state.store


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    # تا پیش از ساخت رابط Next.js، بازدیدکننده صفحه اصلی را به مستندات API می‌فرستیم.
    return RedirectResponse(url="/docs")


@app.get("/favicon.ico", include_in_schema=False, status_code=204)
def favicon() -> Response:
    # مرورگر favicon را خودکار درخواست می‌کند؛ پاسخ خالی مانع ثبت 404 غیرمهم می‌شود.
    return Response(status_code=204)


@app.get("/api/v1/health")
def health(request: Request) -> dict[str, object]:
    store = _store(request)
    return {"status": "ok", "dataset_rows": int(len(store.frame))}


@app.get("/api/v1/metadata", response_model=MetadataResponse)
def metadata(request: Request) -> dict[str, object]:
    frame = _store(request).frame
    return {
        "dataset_date_range": {
            "min": frame["Order Date"].min().date(),
            "max": frame["Order Date"].max().date(),
        },
        "years": sorted(int(year) for year in frame["Order Date"].dt.year.unique()),
        "categories": sorted(frame["Category"].unique().tolist()),
        "subcategories": sorted(frame["Sub-Category"].unique().tolist()),
        "regions": sorted(frame["Region"].unique().tolist()),
        "segments": sorted(frame["Segment"].unique().tolist()),
        "states": [
            {"state": state, "state_code": get_state_code(state)}
            for state in sorted(frame["State"].unique().tolist())
        ],
    }


@app.post("/api/v1/dashboard", response_model=DashboardResponse)
def dashboard(filters: DashboardFilters, request: Request) -> dict[str, object]:
    # مقدارهای فیلتر با داده واقعی بررسی می‌شوند تا Category یا Region اشتباه وارد محاسبه نشود.
    try:
        return build_dashboard(_store(request), filters)
    except FilterValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
