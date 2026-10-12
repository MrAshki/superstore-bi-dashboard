export type Language = "fa" | "en";

export type DashboardFilters = {
  date_from: string | null;
  date_to: string | null;
  years: number[];
  regions: string[];
  segments: string[];
  categories: string[];
  subcategories: string[];
  states: string[];
};

export type HealthResponse = {
  status: "ok";
  dataset_rows: number;
};

export type MetadataResponse = {
  dataset_date_range: { min: string; max: string };
  years: number[];
  categories: string[];
  subcategories: string[];
  regions: string[];
  segments: string[];
  states: Array<{ state: string; state_code: string | null }>;
};

export type KpiResponse = {
  total_sales: number;
  total_profit: number;
  profit_margin: number | null;
  unique_orders: number;
  line_items: number;
  negative_profit_line_items: number;
};

export type MonthlyTrend = { year_month: string; sales: number; profit: number };
export type Category = { category: string; sales: number; profit: number; profit_margin: number | null };
export type Region = { region: string; sales: number; profit: number; profit_margin: number | null };
export type State = {
  state: string;
  state_code: string | null;
  sales: number;
  profit: number;
  profit_margin: number | null;
  unique_orders: number;
};

export type Profitability = {
  kpis: {
    furniture_sales: number;
    furniture_profit: number;
    furniture_margin: number | null;
    high_discount_sales_share: number | null;
    top_10_loss_share: number | null;
  };
  discount_bands: Array<{
    discount_band: "up_to_20" | "above_20";
    sales: number;
    profit: number;
    profit_margin: number | null;
    line_items: number;
    loss_line_items: number;
    loss_line_share: number | null;
  }>;
  subcategories: Array<{
    subcategory: string;
    sales: number;
    profit: number;
    profit_margin: number | null;
    average_discount: number | null;
    low_discount_profit: number;
    high_discount_profit: number;
  }>;
  states: Array<{
    state: string;
    sales: number;
    profit: number;
    profit_margin: number | null;
    average_discount: number | null;
  }>;
};

export type DashboardResponse = {
  applied_filters: DashboardFilters;
  filtered_rows: number;
  kpis: KpiResponse;
  monthly_trends: MonthlyTrend[];
  categories: Category[];
  subcategories: Array<Category & { subcategory: string }>;
  regions: Region[];
  states: State[];
  profitability: Profitability;
};

export const emptyFilters: DashboardFilters = {
  date_from: null,
  date_to: null,
  years: [],
  regions: [],
  segments: [],
  categories: [],
  subcategories: [],
  states: [],
};

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/v1${path}`, {
    ...init,
    // درخواست معطل پس از 15 ثانیه خطا می‌دهد تا رابط در loading باقی نماند.
    signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "detail" in body && typeof body.detail === "string") {
        detail = body.detail;
      }
    } catch {
      // پاسخ غیر JSON با status خود به کاربر گزارش می‌شود.
    }
    throw new ApiError(detail || `Request failed (${response.status})`, response.status);
  }

  return (await response.json()) as T;
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health", { signal });
}

export function getMetadata(signal?: AbortSignal): Promise<MetadataResponse> {
  return apiFetch<MetadataResponse>("/metadata", { signal });
}

export function getDashboard(filters: DashboardFilters, signal?: AbortSignal): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>("/dashboard", {
    method: "POST",
    body: JSON.stringify(filters),
    signal,
  });
}
