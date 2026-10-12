from __future__ import annotations

from datetime import date

import pandas as pd

from .data_loader import DatasetStore
from .schemas import DashboardFilters


class FilterValidationError(ValueError):
    pass


def _validate_values(field: str, supplied: list[str], available: set[str]) -> None:
    unknown = sorted(set(supplied).difference(available))
    if unknown:
        raise FilterValidationError(f"Unknown {field}: {unknown}")


def apply_filters(store: DatasetStore, filters: DashboardFilters) -> pd.DataFrame:
    frame = store.frame
    _validate_values("years", [str(year) for year in filters.years], {str(year) for year in frame["Order Date"].dt.year.unique()})
    dimensions = {
        "regions": "Region", "segments": "Segment", "categories": "Category",
        "subcategories": "Sub-Category", "states": "State",
    }
    for filter_name, column in dimensions.items():
        supplied = getattr(filters, filter_name)
        _validate_values(filter_name, supplied, set(frame[column].unique()))

    # یک mask مشترک باعث می‌شود فیلترهای بُعدهای مختلف با منطق AND ترکیب شوند.
    mask = pd.Series(True, index=frame.index)
    if filters.date_from:
        mask &= frame["Order Date"] >= pd.Timestamp(filters.date_from)
    if filters.date_to:
        mask &= frame["Order Date"] <= pd.Timestamp(filters.date_to)
    if filters.years:
        mask &= frame["Order Date"].dt.year.isin(filters.years)
    for filter_name, column in dimensions.items():
        supplied = getattr(filters, filter_name)
        if supplied:
            # isin یعنی انتخاب چند Region یا Category با منطق OR انجام می‌شود.
            mask &= frame[column].isin(supplied)
    return frame.loc[mask].copy()


def effective_months(store: DatasetStore, filters: DashboardFilters) -> pd.PeriodIndex:
    # ماه‌های نمودار فقط در محدوده واقعی داده و سال‌های انتخاب‌شده ساخته می‌شوند.
    start = store.min_order_date.date()
    end = store.max_order_date.date()
    if filters.date_from:
        start = max(start, filters.date_from)
    if filters.date_to:
        end = min(end, filters.date_to)
    if start > end:
        return pd.PeriodIndex([], freq="M")
    months = pd.period_range(start=date(start.year, start.month, 1), end=date(end.year, end.month, 1), freq="M")
    if filters.years:
        months = months[months.year.isin(filters.years)]
    return months
