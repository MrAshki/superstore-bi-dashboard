import type { DashboardFilters, MetadataResponse } from "./api";
import type { Messages } from "./i18n";

export function freshFilters(): DashboardFilters {
  return { date_from: null, date_to: null, years: [], regions: [], segments: [], categories: [], subcategories: [], states: [] };
}

// همهٔ فیلترها در کلید cache هستند؛ ترتیب انتخاب نباید نتیجهٔ آن را عوض کند.
export function filterKey(filters: DashboardFilters): string {
  return JSON.stringify({ ...filters, years: [...filters.years].sort(), regions: [...filters.regions].sort(), segments: [...filters.segments].sort(), categories: [...filters.categories].sort(), subcategories: [...filters.subcategories].sort(), states: [...filters.states].sort() });
}
export function isBaseline(filters: DashboardFilters): boolean { return filterKey(filters) === filterKey(freshFilters()); }
export function filterSummary(filters: DashboardFilters, t: Messages): string {
  const dimensions: Array<[string, readonly (string | number)[]]> = [
    [t.year, filters.years], [t.region, filters.regions], [t.segment, filters.segments],
    [t.category, filters.categories], [t.subcategory, filters.subcategories], [t.state, filters.states],
  ];
  const parts = dimensions.filter(([, values]) => values.length).map(([label, values]) => `${label}: ${values.join(", ")}`);
  if (filters.date_from || filters.date_to) parts.unshift(`${t.period}: ${filters.date_from ?? "…"} – ${filters.date_to ?? "…"}`);
  return parts.join(" · ") || t.allData;
}
export function reportingPeriod(filters: DashboardFilters, metadata: MetadataResponse | null): string {
  if (!metadata) return "—";
  let start = filters.date_from ?? metadata.dataset_date_range.min;
  let end = filters.date_to ?? metadata.dataset_date_range.max;
  if (!filters.years.length) return `${start} – ${end}`;
  const selected = [...filters.years].sort((a,b) => a-b);
  start = start > `${selected[0]}-01-01` ? start : `${selected[0]}-01-01`;
  end = end < `${selected.at(-1)}-12-31` ? end : `${selected.at(-1)}-12-31`;
  if(start>end) return `${filters.date_from ?? metadata.dataset_date_range.min} – ${filters.date_to ?? metadata.dataset_date_range.max} · ${selected.join(", ")}`;
  return `${start} – ${end} · ${selected.join(", ")}`;
}
