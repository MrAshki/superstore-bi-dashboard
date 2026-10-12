from __future__ import annotations

from datetime import date

import pytest

from backend.app.analytics import build_dashboard
from backend.app.filters import FilterValidationError, apply_filters
from backend.app.schemas import DashboardFilters


# این آزمون‌ها موتور تحلیل را با CSV واقعی بررسی می‌کنند، نه با داده ساختگی.
def test_unfiltered_kpis_match_regression_values(store):
    result = build_dashboard(store, DashboardFilters())
    assert result["kpis"] == {
        "total_sales": 278312.01, "total_profit": 27147.41, "profit_margin": 9.75,
        "unique_orders": 553, "line_items": 1163, "negative_profit_line_items": 213,
    }


def test_category_aggregates_use_analytics_engine(store):
    result = build_dashboard(store, DashboardFilters())
    categories = {row["category"]: row for row in result["categories"]}
    assert categories["Furniture"]["sales"] == 94647.92
    assert categories["Furniture"]["profit"] == 146.56
    assert categories["Office Supplies"]["sales"] == 75069.08
    assert categories["Office Supplies"]["profit"] == 13969.17
    assert categories["Technology"]["sales"] == 108595.01
    assert categories["Technology"]["profit"] == 13031.68


def test_year_filter_uses_order_date(store):
    result = build_dashboard(store, DashboardFilters(years=[2014]))
    expected = store.frame[store.frame["Order Date"].dt.year == 2014]
    assert result["filtered_rows"] == len(expected)
    assert result["kpis"]["total_sales"] == pytest.approx(float(expected["Sales"].sum()), abs=0.01)
    assert all(item["year_month"].startswith("2014-") for item in result["monthly_trends"])


def test_region_filter_uses_or_semantics(store):
    result = build_dashboard(store, DashboardFilters(regions=["Central", "South"]))
    expected_rows = store.frame[store.frame["Region"].isin(["Central", "South"])]
    assert result["filtered_rows"] == len(expected_rows)
    assert result["kpis"]["total_sales"] == pytest.approx(float(expected_rows["Sales"].sum()), abs=0.01)


def test_category_and_subcategory_filters(store):
    result = build_dashboard(store, DashboardFilters(categories=["Furniture"], subcategories=["Chairs"]))
    assert result["categories"] == [{"category": "Furniture", "sales": 35858.82, "profit": 3765.99, "profit_margin": 10.5}]
    assert result["subcategories"][0]["subcategory"] == "Chairs"


def test_combined_filters_apply_and_semantics(store):
    filters = DashboardFilters(years=[2016], regions=["West"], segments=["Consumer"], categories=["Technology"])
    result = build_dashboard(store, filters)
    expected = store.frame[
        (store.frame["Order Date"].dt.year == 2016)
        & (store.frame["Region"] == "West")
        & (store.frame["Segment"] == "Consumer")
        & (store.frame["Category"] == "Technology")
    ]
    assert result["filtered_rows"] == len(expected)
    assert result["kpis"]["unique_orders"] == expected["Order ID"].nunique()


def test_date_boundaries_are_inclusive(store):
    target = date(2014, 1, 4)
    result = build_dashboard(store, DashboardFilters(date_from=target, date_to=target))
    assert result["filtered_rows"] == int((store.frame["Order Date"].dt.date == target).sum())


def test_empty_filter_result_has_zero_kpis_and_no_margin(store):
    result = build_dashboard(store, DashboardFilters(date_from=date(2030, 1, 1), date_to=date(2030, 12, 31)))
    assert result["filtered_rows"] == 0
    assert result["kpis"]["total_sales"] == 0.0
    assert result["kpis"]["profit_margin"] is None
    assert result["categories"] == []
    assert result["monthly_trends"] == []


def test_monthly_trends_are_chronological_and_consistent(store):
    result = build_dashboard(store, DashboardFilters())
    months = [item["year_month"] for item in result["monthly_trends"]]
    assert months == sorted(months)
    expected = store.frame.assign(year_month=store.frame["Order Date"].dt.to_period("M").astype(str)).groupby("year_month")["Sales"].sum()
    actual = {item["year_month"]: item["sales"] for item in result["monthly_trends"]}
    assert actual == {month: pytest.approx(value, abs=0.01) for month, value in expected.items()}


def test_negative_profit_and_state_mapping_are_preserved(store):
    result = build_dashboard(store, DashboardFilters())
    assert result["kpis"]["negative_profit_line_items"] == 213
    assert all(item["state_code"] for item in result["states"])


def test_chart_aggregates_are_consistent_with_kpis(store):
    result = build_dashboard(store, DashboardFilters(regions=["West"]))
    assert sum(item["sales"] for item in result["categories"]) == pytest.approx(result["kpis"]["total_sales"], abs=0.02)
    assert sum(item["profit"] for item in result["regions"]) == pytest.approx(result["kpis"]["total_profit"], abs=0.02)
    assert sum(item["sales"] for item in result["states"]) == pytest.approx(result["kpis"]["total_sales"], abs=0.02)


def test_furniture_profitability_reconciles_discount_drivers(store):
    result = build_dashboard(store, DashboardFilters())
    profitability = result["profitability"]
    assert profitability["kpis"] == {
        "furniture_sales": 94647.92,
        "furniture_profit": 146.56,
        "furniture_margin": 0.15,
        "high_discount_sales_share": 30.42,
        "top_10_loss_share": 56.38,
    }
    bands = {row["discount_band"]: row for row in profitability["discount_bands"]}
    assert bands["up_to_20"]["profit"] == 9020.86
    assert bands["above_20"]["profit"] == -8874.30
    assert bands["above_20"]["loss_line_share"] == 98.18
    assert sum(row["profit"] for row in bands.values()) == pytest.approx(146.56, abs=0.01)


def test_profitability_uses_global_filters_and_handles_no_furniture(store):
    result = build_dashboard(store, DashboardFilters(categories=["Technology"]))
    assert result["profitability"]["kpis"]["furniture_sales"] == 0.0
    assert result["profitability"]["kpis"]["furniture_margin"] is None
    assert result["profitability"]["subcategories"] == []
    assert result["profitability"]["states"] == []


def test_unknown_filter_value_is_rejected(store):
    with pytest.raises(FilterValidationError):
        apply_filters(store, DashboardFilters(regions=["Unknown Region"]))
