from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field, model_validator


class DashboardFilters(BaseModel):
    # لیست خالی یعنی این بُعد فیلتر ندارد و همه مقدارهای آن در نتیجه می‌مانند.
    date_from: date | None = None
    date_to: date | None = None
    years: list[int] = Field(default_factory=list)
    regions: list[str] = Field(default_factory=list)
    segments: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    subcategories: list[str] = Field(default_factory=list)
    states: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_date_range(self) -> "DashboardFilters":
        # بازه تاریخ شامل دو مرز است؛ پس فقط ترتیب نادرست تاریخ‌ها را رد می‌کنیم.
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("date_from must be before or equal to date_to")
        return self


class KPIResponse(BaseModel):
    total_sales: float
    total_profit: float
    profit_margin: float | None
    unique_orders: int
    line_items: int
    negative_profit_line_items: int


class MonthlyTrendResponse(BaseModel):
    year_month: str
    sales: float
    profit: float


class CategoryResponse(BaseModel):
    category: str
    sales: float
    profit: float
    profit_margin: float | None


class SubcategoryResponse(CategoryResponse):
    subcategory: str


class RegionResponse(BaseModel):
    region: str
    sales: float
    profit: float
    profit_margin: float | None


class StateResponse(BaseModel):
    state: str
    state_code: str | None
    sales: float
    profit: float
    profit_margin: float | None
    unique_orders: int


class ProfitabilityKPIResponse(BaseModel):
    furniture_sales: float
    furniture_profit: float
    furniture_margin: float | None
    high_discount_sales_share: float | None
    top_10_loss_share: float | None


class DiscountBandResponse(BaseModel):
    discount_band: str
    sales: float
    profit: float
    profit_margin: float | None
    line_items: int
    loss_line_items: int
    loss_line_share: float | None


class ProfitabilitySubcategoryResponse(BaseModel):
    subcategory: str
    sales: float
    profit: float
    profit_margin: float | None
    average_discount: float | None
    low_discount_profit: float
    high_discount_profit: float


class ProfitabilityStateResponse(BaseModel):
    state: str
    sales: float
    profit: float
    profit_margin: float | None
    average_discount: float | None


class ProfitabilityResponse(BaseModel):
    kpis: ProfitabilityKPIResponse
    discount_bands: list[DiscountBandResponse]
    subcategories: list[ProfitabilitySubcategoryResponse]
    states: list[ProfitabilityStateResponse]


class DashboardResponse(BaseModel):
    # همه بخش‌های پاسخ باید از یک DataFrame فیلترشده بیایند تا اعداد نمودارها با KPIها سازگار باشند.
    applied_filters: DashboardFilters
    filtered_rows: int
    kpis: KPIResponse
    monthly_trends: list[MonthlyTrendResponse]
    categories: list[CategoryResponse]
    subcategories: list[SubcategoryResponse]
    regions: list[RegionResponse]
    states: list[StateResponse]
    profitability: ProfitabilityResponse


class StateMetadata(BaseModel):
    state: str
    state_code: str | None


class MetadataResponse(BaseModel):
    dataset_date_range: dict[str, date]
    years: list[int]
    categories: list[str]
    subcategories: list[str]
    regions: list[str]
    segments: list[str]
    states: list[StateMetadata]
