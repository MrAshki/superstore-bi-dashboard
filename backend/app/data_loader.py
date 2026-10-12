from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd


REQUIRED_COLUMNS = {
    "Row ID", "Order ID", "Order Date", "Ship Date", "Ship Mode", "Customer ID",
    "Customer Name", "Segment", "Country", "City", "State", "Postal Code", "Region",
    "Product ID", "Category", "Sub-Category", "Product Name", "Sales", "Quantity",
    "Discount", "Profit",
}
NUMERIC_COLUMNS = ("Row ID", "Sales", "Quantity", "Discount", "Profit")
DATE_COLUMNS = ("Order Date", "Ship Date")


class DatasetValidationError(ValueError):
    pass


@dataclass(frozen=True)
class DatasetStore:
    frame: pd.DataFrame
    source_path: Path

    @property
    def min_order_date(self) -> pd.Timestamp:
        return self.frame["Order Date"].min()

    @property
    def max_order_date(self) -> pd.Timestamp:
        return self.frame["Order Date"].max()


def _raise_invalid(column: str, mask: pd.Series, raw: pd.Series, kind: str) -> None:
    if mask.any():
        examples = raw.loc[mask].head(3).astype(str).tolist()
        raise DatasetValidationError(
            f"{column} has {int(mask.sum())} invalid {kind} value(s): {examples}"
        )


def load_dataset(path: Path) -> DatasetStore:
    if not path.is_file():
        raise DatasetValidationError(f"Dataset file was not found: {path}")

    # ابتدا همه مقدارها متن خوانده می‌شوند تا خطای CSV را با مقدار اصلی آن گزارش کنیم.
    raw = pd.read_csv(path, dtype="string", keep_default_na=False, encoding="utf-8")
    missing_columns = REQUIRED_COLUMNS.difference(raw.columns)
    if missing_columns:
        raise DatasetValidationError(f"Dataset is missing required columns: {sorted(missing_columns)}")

    if raw.empty:
        raise DatasetValidationError("Dataset has no data rows")

    for column in REQUIRED_COLUMNS:
        _raise_invalid(column, raw[column].str.strip().eq(""), raw[column], "blank")

    frame = raw.copy()
    for column in NUMERIC_COLUMNS:
        # تبدیل نامعتبر به NaN می‌شود؛ سپس آن ردیف را حذف نمی‌کنیم و خطای روشن می‌دهیم.
        converted = pd.to_numeric(raw[column], errors="coerce")
        _raise_invalid(column, converted.isna(), raw[column], "numeric")
        frame[column] = converted

    for column in DATE_COLUMNS:
        # فرمت صریح ISO جلوی تفسیر اشتباه ماه و روز را می‌گیرد.
        converted = pd.to_datetime(raw[column], format="%Y-%m-%d", errors="coerce")
        _raise_invalid(column, converted.isna(), raw[column], "date")
        frame[column] = converted

    # Postal Code شناسه مکانی است، نه مقدار قابل جمع؛ صفر ابتدای آن باید حفظ شود.
    frame["Postal Code"] = raw["Postal Code"].astype("string")
    if (frame["Ship Date"] < frame["Order Date"]).any():
        raise DatasetValidationError("Ship Date occurs before Order Date")

    return DatasetStore(frame=frame, source_path=path)
