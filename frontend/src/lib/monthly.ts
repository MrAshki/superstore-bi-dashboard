import type { DashboardFilters, DashboardResponse, MonthlyTrend } from "./api";

export type MonthlyObservation = MonthlyTrend & { observed: boolean };
export type MonthlyPoint = {
  year_month: string;
  position: number;
  sales: number | null;
  profit: number | null;
  profit_margin: number | null;
  moving_average: number | null;
  observed: boolean;
};

export function monthPosition(month: string): number {
  const [year, value] = month.split("-").map(Number);
  return year * 12 + value - 1;
}

// فقط ماه‌های صفر نیاز به بررسی دارند؛ مقدار غیرصفر وجود مشاهده را ثابت می‌کند.
export async function resolveMonthlyObservations(
  data: DashboardResponse,
  signal: AbortSignal,
  request: (filters: DashboardFilters, signal: AbortSignal) => Promise<DashboardResponse>,
): Promise<MonthlyObservation[]> {
  const rows = data.monthly_trends.map(row => ({ ...row, observed: data.filtered_rows > 0 }));
  if (!data.filtered_rows) return rows.map(row => ({ ...row, observed: false }));
  const pending = rows.filter(row => row.sales === 0 && row.profit === 0);
  let next = 0;

  // هر درخواست همان فیلترهای سراسری را دارد؛ بازهٔ ماه فقط با آن‌ها اشتراک می‌گیرد.
  await Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
    while (next < pending.length) {
      signal.throwIfAborted();
      const row = pending[next++];
      const [year, month] = row.year_month.split("-").map(Number);
      const start = `${row.year_month}-01`;
      const end = `${row.year_month}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
      const filters = data.applied_filters;
      const result = await request({
        ...filters,
        date_from: filters.date_from && filters.date_from > start ? filters.date_from : start,
        date_to: filters.date_to && filters.date_to < end ? filters.date_to : end,
      }, signal);
      signal.throwIfAborted();
      row.observed = result.filtered_rows > 0;
    }
  }));
  return rows;
}

export function buildMonthlySeries(rows: MonthlyObservation[]): MonthlyPoint[] {
  if (!rows.length) return [];
  const lookup = new Map(rows.map(row => [monthPosition(row.year_month), row]));
  const indices = [...lookup.keys()].sort((a, b) => a - b);
  const series: MonthlyPoint[] = [];
  for (let position = indices[0]; position <= indices.at(-1)!; position++) {
    const row = lookup.get(position);
    const observed = row?.observed === true;
    const sales = observed ? row.sales : null;
    const profit = observed ? row.profit : null;
    const point: MonthlyPoint = {
      position,
      year_month: `${Math.floor(position / 12)}-${String(position % 12 + 1).padStart(2, "0")}`,
      sales,
      profit,
      observed,
      // نسبت مجموع‌های ماه، نه میانگین حاشیهٔ ردیف‌ها؛ فروش صفر حاشیهٔ تعریف‌شده ندارد.
      profit_margin: sales !== null && sales !== 0 && profit !== null ? profit / sales * 100 : null,
      moving_average: null,
    };
    series.push(point);
    const window = series.slice(-3);
    // میانگین فقط از سه ماه تقویمی متوالیِ دارای مشاهده ساخته می‌شود.
    if (window.length === 3 && window.every(item => item.sales !== null)) {
      point.moving_average = window.reduce((sum, item) => sum + item.sales!, 0) / 3;
    }
  }
  return series;
}

export function monthlyExtremes(series: MonthlyPoint[]): { peak: MonthlyPoint | null; loss: MonthlyPoint | null } {
  const observed = series.filter(row => row.observed);
  return {
    peak: observed.reduce<MonthlyPoint | null>((best, row) => best === null || row.sales! > best.sales! ? row : best, null),
    loss: observed.filter(row => row.profit! < 0).reduce<MonthlyPoint | null>((best, row) => best === null || row.profit! < best.profit! ? row : best, null),
  };
}
