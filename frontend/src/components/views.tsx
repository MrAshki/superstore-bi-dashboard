"use client";

import { useState } from "react";
import type { DashboardResponse, State } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { interpolate, type Messages } from "@/lib/i18n";
import type { MonthlyObservation } from "@/lib/monthly";
import { Card, DiscountBandComparison, Empty, FurnitureStateLossTable, Kpis, LossTable, MonthlyCharts, Numeric, ProfitabilityKpis, ProfitBridge, ProfitComparison, StateMap, StateScatter, SubcategoryDiscountChart } from "./charts";

export type AnnualComparison = { previous: number; current: number };
export type ViewId = "overview" | "products" | "profitability" | "geography";

function FindingText({template,values}:{template:string;values:Record<string,string>}) {
  return <p>{template.split(/(\{\w+\})/g).map((part,index)=>{
    const key=part.match(/^\{(\w+)\}$/)?.[1];
    return key ? <Numeric key={index} negative={values[key]?.startsWith("-")}>{values[key]}</Numeric> : part;
  })}</p>;
}

export function Findings({ data, annual, t }: {data:DashboardResponse;annual:AnnualComparison|null;t:Messages}) {
  const furniture = data.categories.find(row=>row.category==="Furniture");
  const tables = data.subcategories.find(row=>row.subcategory==="Tables");
  const bookcases = data.subcategories.find(row=>row.subcategory==="Bookcases");
  return <div className="findings">
    {furniture && tables && bookcases && <article><h2>{t.furnitureTitle}</h2><FindingText template={t.furnitureText} values={{sales:formatCurrency(furniture.sales),profit:formatCurrency(furniture.profit),margin:formatPercent(furniture.profit_margin),loss:formatCurrency(tables.profit+bookcases.profit)}}/></article>}
    {annual && <article><h2>{t.annualTitle}</h2><FindingText template={t.annualText} values={{previous:formatCurrency(annual.previous),current:formatCurrency(annual.current),decline:formatCurrency(annual.previous-annual.current)}}/></article>}
  </div>;
}

export function Overview({data,monthly,baseline,annual,t}:{data:DashboardResponse;monthly:MonthlyObservation[];baseline:boolean;annual:AnnualComparison|null;t:Messages}) {
  return <div className="view-content overview-view"><Kpis data={data} t={t} />
    {baseline && <Findings data={data} annual={annual} t={t}/>}
    <Card title={t.monthly}><MonthlyCharts rows={monthly} t={t}/></Card>
    <div className="comparison-grid">
      <Card title={t.categoryProfit}><ProfitComparison rows={data.categories.map(row=>({...row,name:row.category}))} t={t}/></Card>
      <Card title={t.regionProfit}><ProfitComparison rows={data.regions.map(row=>({...row,name:row.region}))} margin={false} groupLabel={t.region} t={t}/></Card>
    </div>
  </div>;
}
export function Products({data,t}:{data:DashboardResponse;t:Messages}) {
  const rows = [...data.subcategories].sort((a,b)=>a.profit-b.profit || a.subcategory.localeCompare(b.subcategory));
  return <div className="view-content products-view"><Card title={t.subcategoryProfit} note={`${t.lowestFirst} · ${interpolate(t.subcategoryNote,{count:String(rows.length)})}`}>
    <ProfitComparison rows={rows.map(row=>({...row,name:row.subcategory}))} products t={t}/>
    <div className="series-legend"><span><i className="legend-positive"/>{t.positiveProfit}</span><span><i className="legend-negative"/>{t.loss}</span></div>
  </Card></div>;
}

export function Profitability({data,t}:{data:DashboardResponse;t:Messages}) {
  const profitability=data.profitability;
  if (!profitability.subcategories.length) return <div className="view-content profitability-view"><Empty t={t}/></div>;
  return <div className="view-content profitability-view">
    <ProfitabilityKpis data={profitability} t={t}/>
    <div className="profitability-grid">
      <Card title={t.discountBridge}><ProfitBridge data={profitability} t={t}/></Card>
      <Card title={t.discountBands}><DiscountBandComparison data={profitability} t={t}/></Card>
    </div>
    <Card title={t.discountSubcategories}><SubcategoryDiscountChart data={profitability} t={t}/></Card>
    <Card title={t.stateFurnitureLosses}><FurnitureStateLossTable data={profitability} t={t}/></Card>
    <p className="chart-note profitability-note">{t.profitabilityNote}</p>
  </div>;
}

function StateDetails({rows,t}:{rows:State[];t:Messages}) {
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState<"state"|"sales"|"profit"|"profit_margin"|"unique_orders">("profit");
  const [descending,setDescending]=useState(false);
  const [page,setPage]=useState(0);
  const filtered=rows.filter(row=>row.state.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>{
    const comparison=sort==="state"?a.state.localeCompare(b.state):(a[sort] ?? -Infinity)-(b[sort] ?? -Infinity);
    return descending ? -comparison : comparison;
  });
  const pages=Math.max(1,Math.ceil(filtered.length/10));
  const activePage=Math.min(page,pages-1);
  const shown=filtered.slice(activePage*10,activePage*10+10);
  return <details className="state-details"><summary className="button">{t.details}</summary><Card title={t.stateDetails}>
    <div className="detail-controls">
      <label>{t.detailSearch}<input type="search" value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}} /></label>
      <label>{t.sort}<select value={sort} onChange={event=>{setSort(event.target.value as typeof sort);setPage(0);}}><option value="state">{t.state}</option><option value="sales">{t.sales}</option><option value="profit">{t.profit}</option><option value="profit_margin">{t.margin}</option><option value="unique_orders">{t.orders}</option></select></label>
      <button className="button" onClick={()=>setDescending(!descending)}>{descending?t.descending:t.ascending}</button>
    </div>
    {!shown.length?<Empty t={t}/>:<div className="table-scroll"><table><thead><tr><th>{t.state}</th><th>{t.sales}</th><th>{t.profit}</th><th>{t.margin}</th><th>{t.orders}</th></tr></thead><tbody>{shown.map(row=><tr key={row.state}><th scope="row"><bdi dir="ltr">{row.state}</bdi></th><td><Numeric>{formatCurrency(row.sales)}</Numeric></td><td><Numeric negative={row.profit<0}>{formatCurrency(row.profit)}</Numeric></td><td><Numeric negative={(row.profit_margin??0)<0}>{formatPercent(row.profit_margin)}</Numeric></td><td><Numeric>{formatNumber(row.unique_orders)}</Numeric></td></tr>)}</tbody></table></div>}
    <div className="pagination"><button className="button" disabled={!activePage} onClick={()=>setPage(activePage-1)}>{t.previous}</button><span>{t.page} <Numeric>{activePage+1} / {pages}</Numeric></span><button className="button" disabled={activePage===pages-1} onClick={()=>setPage(activePage+1)}>{t.next}</button></div>
  </Card></details>;
}

export function Geography({data,baseline,t,report=false}:{data:DashboardResponse;baseline:boolean;t:Messages;report?:boolean}) {
  const [metric,setMetric]=useState<"sales"|"profit">("profit");
  return <div className="view-content geography-view">
    <div className="geography-grid">
      <Card title={metric==="profit"?t.mapProfit:t.mapSales} action={!report&&<div className="metric-switch"><button className={metric==="profit"?"active":""} onClick={()=>setMetric("profit")} aria-pressed={metric==="profit"}>{t.profit}</button><button className={metric==="sales"?"active":""} onClick={()=>setMetric("sales")} aria-pressed={metric==="sales"}>{t.sales}</button></div>}>
        <StateMap rows={data.states} metric={metric} t={t}/><p className="asset-credit">{t.mapSource}</p>
      </Card>
      <Card title={t.scatter}><StateScatter rows={data.states} baseline={baseline} t={t}/></Card>
    </div>
    <Card title={t.losses}><LossTable rows={data.states} t={t}/></Card>
    {!report&&<StateDetails rows={data.states} t={t}/>}
  </div>;
}
