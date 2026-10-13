"use client";

import type { DashboardFilters, DashboardResponse, Language, MetadataResponse } from "@/lib/api";
import { getMessages } from "@/lib/i18n";
import { filterSummary, isBaseline, reportingPeriod } from "@/lib/presentation";
import { formatNumber } from "@/lib/format";
import { Geography, Overview, Products, Profitability, type ViewId } from "./views";
import { Numeric } from "./charts";
import type { MonthlyObservation } from "@/lib/monthly";

export const reportViews: ViewId[] = ["overview","products","profitability","geography"];
export const filenames = ["01-overview.png","02-products.png","03-profitability.png","04-geography.png"];

export function Reports({data,monthly,filters,metadata,language}:{data:DashboardResponse;monthly:MonthlyObservation[];filters:DashboardFilters;metadata:MetadataResponse;language:Language}) {
  const t=getMessages(language);
  const baseline=isBaseline(filters);
  return <div className="report-stage" aria-hidden="true" inert>
    {reportViews.map(view=><article className={`report-canvas report-${view}`} data-report={view} key={view} dir={language==="fa"?"rtl":"ltr"} lang={language}>
      <header className="report-header"><div><h1>{t.title}</h1><h2>{t[view]}</h2></div><div><p>{t.period}</p><Numeric>{reportingPeriod(filters,metadata)}</Numeric></div></header>
      <div className="report-filter-summary">{filterSummary(filters,t)}</div>
      {view==="overview"?<Overview data={data} monthly={monthly} baseline={baseline} t={t}/>:view==="products"?<Products data={data} t={t}/>:view==="profitability"?<Profitability data={data} t={t}/>:<Geography data={data} t={t} report/>}
      <footer className="report-footer"><span>{t.source}: <bdi dir="ltr">superstore-sales.csv</bdi> · <Numeric>{formatNumber(data.filtered_rows)}</Numeric> {t.observations}</span><span>{view==="geography"?t.mapSource:t.financialNote}</span></footer>
    </article>)}
  </div>;
}
