from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

import pandas as pd

from .data_loader import DatasetStore
from .filters import apply_filters, effective_months
from .schemas import DashboardFilters
from .state_codes import get_state_code


CENT = Decimal("0.01")


def _number(value: float | int) -> float:
    # ابتدا جمع دقیق‌تر انجام می‌شود و فقط مقدار نهاییِ API تا دو رقم اعشار گرد می‌شود.
    return float(Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP))


def _margin(sales: float, profit: float) -> float | None:
    # تقسیم Profit بر Sales صفر معنا ندارد؛ در این حالت null برمی‌گردانیم.
    if sales == 0:
        return None
    return _number(Decimal(str(profit)) / Decimal(str(sales)) * Decimal("100"))


def _summaries(frame: pd.DataFrame, columns: list[str]) -> list[dict[str, object]]:
    if frame.empty:
        return []
    grouped = frame.groupby(columns, as_index=False, sort=True).agg(
        sales=("Sales", "sum"), profit=("Profit", "sum")
    )
    return [
        {
            **{column: str(row[column]) for column in columns},
            "sales": _number(row["sales"]),
            "profit": _number(row["profit"]),
            "profit_margin": _margin(row["sales"], row["profit"]),
        }
        for _, row in grouped.iterrows()
    ]


def _share(numerator: float | int, denominator: float | int) -> float | None:
    if denominator == 0:
        return None
    return _number(Decimal(str(numerator)) / Decimal(str(denominator)) * Decimal("100"))


def _profitability(frame: pd.DataFrame) -> dict[str, object]:
    # این نما فقط Furniture را بررسی می‌کند، اما همهٔ فیلترهای سراسری را حفظ می‌کند.
    furniture = frame.loc[frame["Category"] == "Furniture"]
    sales = float(furniture["Sales"].sum()) if not furniture.empty else 0.0
    profit = float(furniture["Profit"].sum()) if not furniture.empty else 0.0
    high_discount = furniture["Discount"] > 0.20
    losses = furniture.loc[furniture["Profit"] < 0, "Profit"]
    gross_loss = float(-losses.sum()) if not losses.empty else 0.0
    top_loss = float(-losses.nsmallest(10).sum()) if not losses.empty else 0.0

    discount_bands: list[dict[str, object]] = []
    for key, mask in (("up_to_20", ~high_discount), ("above_20", high_discount)):
        group = furniture.loc[mask]
        group_sales = float(group["Sales"].sum()) if not group.empty else 0.0
        group_profit = float(group["Profit"].sum()) if not group.empty else 0.0
        loss_count = int((group["Profit"] < 0).sum()) if not group.empty else 0
        discount_bands.append({
            "discount_band": key,
            "sales": _number(group_sales),
            "profit": _number(group_profit),
            "profit_margin": _margin(group_sales, group_profit),
            "line_items": int(len(group)),
            "loss_line_items": loss_count,
            "loss_line_share": _share(loss_count, len(group)),
        })

    subcategories: list[dict[str, object]] = []
    if not furniture.empty:
        for subcategory, group in furniture.groupby("Sub-Category", sort=True):
            group_sales = float(group["Sales"].sum())
            group_profit = float(group["Profit"].sum())
            group_high_discount = group["Discount"] > 0.20
            subcategories.append({
                "subcategory": str(subcategory),
                "sales": _number(group_sales),
                "profit": _number(group_profit),
                "profit_margin": _margin(group_sales, group_profit),
                "average_discount": _number(float(group["Discount"].mean()) * 100),
                "low_discount_profit": _number(float(group.loc[~group_high_discount, "Profit"].sum())),
                "high_discount_profit": _number(float(group.loc[group_high_discount, "Profit"].sum())),
            })
        subcategories.sort(key=lambda item: (float(item["profit"]), str(item["subcategory"])))

    states: list[dict[str, object]] = []
    if not furniture.empty:
        for state, group in furniture.groupby("State", sort=True):
            group_sales = float(group["Sales"].sum())
            group_profit = float(group["Profit"].sum())
            states.append({
                "state": str(state),
                "sales": _number(group_sales),
                "profit": _number(group_profit),
                "profit_margin": _margin(group_sales, group_profit),
                "average_discount": _number(float(group["Discount"].mean()) * 100),
            })
        states.sort(key=lambda item: (float(item["profit"]), str(item["state"])))

    return {
        "kpis": {
            "furniture_sales": _number(sales),
            "furniture_profit": _number(profit),
            "furniture_margin": _margin(sales, profit),
            "high_discount_sales_share": _share(float(furniture.loc[high_discount, "Sales"].sum()), sales),
            "top_10_loss_share": _share(top_loss, gross_loss),
        },
        "discount_bands": discount_bands,
        "subcategories": subcategories,
        "states": states,
    }


def build_dashboard(store: DatasetStore, filters: DashboardFilters) -> dict[str, object]:
    # همه KPIها و نمودارها از همین DataFrame ساخته می‌شوند تا نتیجه‌ها یکسان باشند.
    frame = apply_filters(store, filters)
    sales = float(frame["Sales"].sum()) if not frame.empty else 0.0
    profit = float(frame["Profit"].sum()) if not frame.empty else 0.0

    # ماه‌های بدون فروش در بازه مؤثر با صفر نشان داده می‌شوند تا خط روند پیوسته باشد.
    monthly_values: dict[pd.Period, tuple[float, float]] = {}
    if not frame.empty:
        groups = frame.assign(_month=frame["Order Date"].dt.to_period("M")).groupby("_month").agg(
            sales=("Sales", "sum"), profit=("Profit", "sum")
        )
        monthly_values = {period: (float(row.sales), float(row.profit)) for period, row in groups.iterrows()}
    monthly_trends = [
        {"year_month": str(month), "sales": _number(monthly_values.get(month, (0.0, 0.0))[0]), "profit": _number(monthly_values.get(month, (0.0, 0.0))[1])}
        for month in effective_months(store, filters)
    ]

    categories = _summaries(frame, ["Category"])
    categories = [{"category": item.pop("Category"), **item} for item in categories]
    subcategories = _summaries(frame, ["Category", "Sub-Category"])
    subcategories = [
        {"category": item.pop("Category"), "subcategory": item.pop("Sub-Category"), **item}
        for item in subcategories
    ]
    subcategories.sort(key=lambda item: (-float(item["profit"]), str(item["subcategory"])))
    regions = _summaries(frame, ["Region"])
    regions = [{"region": item.pop("Region"), **item} for item in regions]

    # Stateهای بدون رکورد اضافه نمی‌شوند؛ رابط کاربری آن‌ها را No Data نمایش می‌دهد.
    states: list[dict[str, object]] = []
    if not frame.empty:
        grouped_states = frame.groupby("State", as_index=False, sort=True).agg(
            sales=("Sales", "sum"), profit=("Profit", "sum"), unique_orders=("Order ID", "nunique")
        )
        states = [
            {
                "state": str(row.State), "state_code": get_state_code(str(row.State)),
                "sales": _number(row.sales), "profit": _number(row.profit),
                "profit_margin": _margin(row.sales, row.profit), "unique_orders": int(row.unique_orders),
            }
            for row in grouped_states.itertuples(index=False)
        ]

    return {
        "applied_filters": filters.model_dump(mode="json"),
        "filtered_rows": int(len(frame)),
        "kpis": {
            "total_sales": _number(sales), "total_profit": _number(profit),
            "profit_margin": _margin(sales, profit), "unique_orders": int(frame["Order ID"].nunique()),
            "line_items": int(len(frame)), "negative_profit_line_items": int((frame["Profit"] < 0).sum()),
        },
        "monthly_trends": monthly_trends, "categories": categories, "subcategories": subcategories,
        "regions": regions, "states": states, "profitability": _profitability(frame),
    }
