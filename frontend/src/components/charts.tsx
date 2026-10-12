"use client";

import { useId, type ReactNode } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { DashboardResponse, State } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { interpolate, type Messages } from "@/lib/i18n";
import { buildMonthlySeries, monthlyExtremes, type MonthlyObservation, type MonthlyPoint } from "@/lib/monthly";
import shapes from "@/assets/us-states.json";

export const COLORS = { sales: "#2563EB", profit: "#0F766E", loss: "#B91C1C", missing: "#E2E8F0", zero: "#F1E9D2", grid: "#E2E8F0", ink: "#0F172A", muted: "#475569" };
export function Numeric({ children, negative = false }: { children: ReactNode; negative?: boolean }) {
  return <bdi dir="ltr" className={`numeric ${negative ? "negative" : ""}`}>{children}</bdi>;
}
export function Empty({ t }: { t: Messages }) { return <p className="empty" role="status">{t.noData}</p>; }
export function Card({ title, note, children, className = "", action }: { title: string; note?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return <section className={`card ${className}`} aria-label={title}><div className="card-heading"><div><h2>{title}</h2>{note && <p>{note}</p>}</div>{action}</div>{children}</section>;
}
export function Kpis({ data, t }: { data: DashboardResponse; t: Messages }) {
  const values = [
    { name: t.totalSales, value: formatCurrency(data.kpis.total_sales), color: "sales" },
    { name: t.totalProfit, value: formatCurrency(data.kpis.total_profit), color: data.kpis.total_profit < 0 ? "negative" : "positive" },
    { name: t.profitMargin, value: formatPercent(data.kpis.profit_margin), color: (data.kpis.profit_margin ?? 0) < 0 ? "negative" : "" },
    { name: t.orders, value: formatNumber(data.kpis.unique_orders), color: "" },
  ];
  return <section className="kpis" aria-label={t.overview}>{values.map(item => <article key={item.name} className="kpi card"><p>{item.name}</p><strong className={item.color}><Numeric>{item.value}</Numeric></strong></article>)}</section>;
}

function compactUSD(value: number): string {
  return `${value < 0 ? "-$" : "$"}${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Math.abs(value))}`;
}

function MonthlyTooltip({ active, payload, t }: Pick<TooltipContentProps, "active" | "payload"> & { t: Messages }) {
  const row: MonthlyPoint | undefined = payload?.[0]?.payload;
  if (!active || !row) return null;
  return <div className="monthly-tooltip" dir={t.chartDirection} role="status">
    <strong><Numeric>{row.year_month}</Numeric></strong>
    {!row.observed ? <p>{t.noObservations}</p> : <dl>
      <dt>{t.sales}</dt><dd><Numeric>{formatCurrency(row.sales!)}</Numeric></dd>
      <dt>{t.profit}</dt><dd><Numeric negative={row.profit! < 0}>{formatCurrency(row.profit!)}</Numeric></dd>
      <dt>{t.margin}</dt><dd><Numeric negative={(row.profit_margin ?? 0) < 0}>{formatPercent(row.profit_margin)}</Numeric></dd>
      {row.moving_average !== null && <><dt>{t.movingAverage}</dt><dd><Numeric>{formatCurrency(row.moving_average)}</Numeric></dd></>}
    </dl>}
  </div>;
}

function MonthTick({ x = 0, y = 0, position, t, first, last }: {
  x?: number; y?: number; position: number; t: Messages; first: number; last: number;
}) {
  const year = Math.floor(position / 12);
  const month = position % 12;
  const name = new Intl.DateTimeFormat(t.chartLocale, { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month, 1)));
  return <g transform={`translate(${x},${y})`} direction="ltr" fill={COLORS.muted}>
    <text y="16" textAnchor="middle" fontSize="13">{name}</text>
    {(month === 0 || position === first || position === last) && <text y="36" textAnchor="middle" fontSize="13" fontWeight="650">{year}</text>}
  </g>;
}

export function MonthlyCharts({ rows, t }: { rows: MonthlyObservation[]; t: Messages }) {
  const syncId = useId();
  const values = buildMonthlySeries(rows);
  const { peak, loss } = monthlyExtremes(values);
  if (!peak) return <Empty t={t} />;
  const first = values[0].position;
  const last = values.at(-1)!.position;
  const ticks = values.filter(row => row.position === first || row.position === last || [0, 3, 6, 9].includes(row.position % 12)).map(row => row.position);
  const boundaries = values.filter(row => row.position % 12 === 0 && row.position !== first).map(row => row.position - .5);
  const low = Math.min(0, ...values.map(row => row.profit ?? 0));
  const high = Math.max(0, ...values.map(row => row.profit ?? 0));
  const padding = (high - low || 1) * .15;
  const profitDomain: [number, number] = [low - padding, high + padding];
  const xDomain: [number, number] = [first - .5, last + .5];

  return <div className="monthly-stack">
    <div className="monthly-extremes">
      <span>{t.peakSales}: <Numeric>{peak.year_month} · {formatCurrency(peak.sales!)}</Numeric></span>
      {loss && <span>{t.biggestLoss}: <Numeric negative>{loss.year_month} · {formatCurrency(loss.profit!)}</Numeric></span>}
    </div>
    <div className="monthly-scroll" dir="ltr"><div className="monthly-plots" style={{ minWidth: Math.max(640, values.length * 22) }}>
      {(["sales", "profit"] as const).map(metric => {
        const highlight = metric === "sales" ? peak : loss;
        const fraction = highlight ? (highlight.position - first) / Math.max(1, last - first) : .5;
        const labelPosition = fraction > .72 ? "left" : fraction < .28 ? "right" : "top";
        return <div className="trend" key={metric}>
          <h3 dir={t.chartDirection}>{metric === "sales" ? t.salesTrend : t.profitTrend}</h3>
          <div className="monthly-series-legend" dir={t.chartDirection}>
            {metric === "sales" ? <><span><i className="legend-sales" />{t.sales}</span><span><i className="legend-average" />{t.movingAverage}</span></> : <><span><i className="legend-positive" />{t.positiveProfit}</span><span><i className="legend-negative" />{t.loss}</span></>}
          </div>
          <div className="trend-plot"><ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={values} syncId={syncId} syncMethod="value" margin={{ top: 32, right: 30, bottom: 0, left: 8 }} accessibilityLayer>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="position" type="number" scale="linear" domain={xDomain} ticks={ticks} interval={0}
                tick={props => <MonthTick x={Number(props.x)} y={Number(props.y)} position={Number(props.payload.value)} t={t} first={first} last={last} />}
                tickLine={false} height={54} />
              <YAxis width={76} domain={metric === "profit" ? profitDomain : [0, "auto"]} tickFormatter={compactUSD}
                tick={{ fontSize: 13, fill: COLORS.muted }} tickLine={false} axisLine={false} />
              {boundaries.map(position => <ReferenceLine key={position} x={position} stroke="#94A3B8" strokeDasharray="4 4" strokeWidth={1.2} />)}
              <ReferenceLine y={0} stroke={metric === "profit" ? COLORS.ink : COLORS.grid} strokeWidth={metric === "profit" ? 2 : 1}
                label={metric === "profit" ? { value: "$0", position: "insideTopLeft", fill: COLORS.ink, fontSize: 12 } : undefined} />
              <Tooltip content={props => <MonthlyTooltip {...props} t={t} />} filterNull={false} isAnimationActive={false} cursor={{ fill: "#0F172A", fillOpacity: .04 }} />
              <Bar dataKey={metric} name={metric === "sales" ? t.sales : t.profit} maxBarSize={22} isAnimationActive={false}>
                {values.map(row => <Cell key={row.position} fill={metric === "sales" ? COLORS.sales : row.profit! < 0 ? COLORS.loss : COLORS.profit} />)}
              </Bar>
              {metric === "sales" && <Line type="linear" dataKey="moving_average" name={t.movingAverage} stroke="#1E40AF" strokeWidth={2.5}
                dot={false} connectNulls={false} isAnimationActive={false} />}
              {values.filter(row => row.observed && row[metric] === 0).map(row => <ReferenceDot key={row.position} x={row.position} y={0} r={3}
                fill={metric === "sales" ? COLORS.sales : COLORS.muted} stroke="#FFFFFF" className="monthly-zero" />)}
              {highlight && <ReferenceDot x={highlight.position} y={highlight[metric]!} r={4} fill={metric === "sales" ? COLORS.sales : COLORS.loss} stroke="#FFFFFF"
                label={{ value: metric === "sales" ? t.peakSales : t.biggestLoss, position: labelPosition, fill: COLORS.ink, fontSize: 12, fontWeight: 600 }} />}
            </ComposedChart>
          </ResponsiveContainer></div>
        </div>;
      })}
    </div></div>
    <p className="monthly-scroll-note">{t.monthlyScroll}</p>
    <p className="chart-note">{t.monthlyNote}</p>
  </div>;
}

export type ComparisonRow = { name: string; sales: number; profit: number; profit_margin: number | null };

export function ProfitComparison({ rows, t, margin = true, products = false, groupLabel }: { rows: ComparisonRow[]; t: Messages; margin?: boolean; products?: boolean; groupLabel?: string }) {
  if (!rows.length) return <Empty t={t} />;
  const observedMin = Math.min(0, ...rows.map(row => row.profit));
  const observedMax = Math.max(0, ...rows.map(row => row.profit));
  const rawStep = (observedMax-observedMin)/4 || 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = ([1,2,5,10].find(value=>value*magnitude>=rawStep) ?? 10)*magnitude;
  const min = Math.floor(observedMin/step)*step;
  const max = Math.ceil(observedMax/step)*step || step;
  const span = max - min || 1;
  const x = (value: number) => 5 + (value - min) / span * 90;
  const zero = x(0);
  const ticks = Array.from({length: Math.round(span/step)+1}, (_, index) => min + step * index);
  return <div className="comparison-scroll"><div className={`comparison ${products ? "product-comparison" : ""} ${margin ? "" : "no-margin"}`} dir="ltr">
    <div className="comparison-head"><span>{groupLabel ?? (products ? t.subcategory : t.category)}</span><span>{t.profitAxis}</span><span>{t.sales}</span><span>{t.profit}</span>{margin && <span>{t.margin}</span>}</div>
    {rows.map(row => <div className="comparison-row" key={row.name}>
      <span className="group-name">{row.name}</span>
      <svg className="bar-track" viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label={`${row.name}: ${t.profit} ${formatCurrency(row.profit)}`}>
        {ticks.map(tick => <line key={tick} x1={x(tick)} x2={x(tick)} y1="0" y2="30" stroke={COLORS.grid} strokeWidth=".3" />)}
        <line x1={zero} x2={zero} y1="0" y2="30" stroke={COLORS.muted} strokeWidth=".5" />
        <rect x={Math.min(x(row.profit), zero)} y="5" width={row.profit===0?0:Math.max(.15, Math.abs(x(row.profit) - zero))} height="20" rx=".4" fill={row.profit < 0 ? COLORS.loss : COLORS.profit} />
      </svg>
      <Numeric>{formatCurrency(row.sales)}</Numeric><Numeric negative={row.profit < 0}>{formatCurrency(row.profit)}</Numeric>
      {margin && <Numeric negative={(row.profit_margin ?? 0) < 0}>{formatPercent(row.profit_margin)}</Numeric>}
    </div>)}
    <div className="comparison-axis"><span /><div>{ticks.map(tick => <span key={tick} style={{ left: `${x(tick)}%` }}>{compactUSD(tick)}</span>)}</div></div>
  </div></div>;
}

function blend(from: string, to: string, amount: number): string {
  const channel = (color: string, index: number) => parseInt(color.slice(index, index + 2), 16);
  return `#${[1,3,5].map(index => Math.round(channel(from,index) + (channel(to,index) - channel(from,index)) * Math.min(1,Math.max(0,amount))).toString(16).padStart(2,"0")).join("")}`;
}

const abbreviations: Record<string, string> = {
  Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",Connecticut:"CT",Delaware:"DE","District of Columbia":"DC",Florida:"FL",Georgia:"GA",Hawaii:"HI",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",Ohio:"OH",Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA","West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY",
};
const smallStates = ["Massachusetts", "Rhode Island", "Connecticut", "New Jersey", "Delaware", "Maryland", "District of Columbia"];

export function StateMap({ rows, metric, t }: { rows: State[]; metric: "sales" | "profit"; t: Messages }) {
  const values = new Map(rows.map(row => [row.state, row]));
  const bound = Math.max(1, ...rows.map(row => Math.abs(row[metric])));
  const fill = (name: string): string => {
    const row = values.get(name);
    if (!row) return COLORS.missing;
    const value = row[metric];
    if (metric === "sales") return blend("#DBEAFE", COLORS.sales, value / bound);
    if (value === 0) return COLORS.zero;
    return blend(value < 0 ? "#FCE8E8" : "#D8F0EA", value < 0 ? COLORS.loss : COLORS.profit, Math.abs(value) / bound);
  };
  const id = useId().replace(/:/g,"");
  return <div className="map-content" dir="ltr">
    <svg viewBox="0 0 1100 650" className="state-map" role="img" aria-label={metric === "profit" ? t.mapProfit : t.mapSales}>
      {shapes.map(shape => <path key={shape.id} d={shape.path ?? ""} fill={fill(shape.name)} stroke="#FFFFFF" strokeWidth="1.5"><title>{shape.name}: {values.has(shape.name) ? formatCurrency(values.get(shape.name)![metric]) : t.noObservations}</title></path>)}
      {shapes.filter(shape => !smallStates.includes(shape.name)).map(shape => {
        const row = values.get(shape.name);
        const dark = row && Math.abs(row[metric]) / bound > .65;
        const dx=shape.name==="Vermont"?-15:shape.name==="New Hampshire"?14:0;
        const dy=shape.name==="Vermont"?-10:shape.name==="New Hampshire"?-4:0;
        return <text x={shape.center[0]+dx} y={shape.center[1]+dy} key={shape.id} textAnchor="middle" dominantBaseline="middle" fontSize="18" fontWeight="600" fill={dark ? "#FFFFFF" : COLORS.ink}>{abbreviations[shape.name]}</text>;
      })}
      {smallStates.map((name, index) => {
        const shape = shapes.find(item => item.name === name)!;
        const y = 230 + index * 36;
        return <g key={name}><path d={`M${shape.center[0]},${shape.center[1]} L1005,${y} L1020,${y}`} fill="none" stroke={COLORS.muted} strokeWidth="1" /><text x="1026" y={y+5} fontSize="18" fill={COLORS.ink}>{abbreviations[name]}</text></g>;
      })}
      <path d="M20,470 H330 V615 M345,545 V615" stroke={COLORS.grid} fill="none" />
    </svg>
    <div className="map-legend">
      {rows.length>0&&<>
      <div className="legend-scale"><svg width="280" height="14" aria-hidden="true"><defs><linearGradient id={`scale-${id}`}><stop stopColor={metric === "profit" ? COLORS.loss : "#DBEAFE"} /><stop offset={metric === "profit" ? ".5" : "1"} stopColor={metric === "profit" ? "#FFFFFF" : COLORS.sales} />{metric === "profit" && <stop offset="1" stopColor={COLORS.profit} />}</linearGradient></defs><rect width="280" height="14" rx="3" fill={`url(#scale-${id})`} /></svg>
        <div><Numeric>{compactUSD(metric === "profit" ? -bound : 0)}</Numeric>{metric === "profit" && <Numeric>$0</Numeric>}<Numeric>{compactUSD(bound)}</Numeric></div>
      </div>
      </>}
      <span><i style={{background:COLORS.missing}} />{t.noObservations}</span>
      {metric === "profit" && <span><i style={{background:COLORS.zero}} />{t.measuredZero}</span>}
    </div>
    <p className="chart-note" dir="auto">{interpolate(t.coverage,{ count: String(rows.length) })}</p>
  </div>;
}

// برابر بودن اندازهٔ نقطه‌ها اجازه می‌دهد فقط موقعیت Sales و Profit با هم مقایسه شوند.
export function StateScatter({ rows, t, baseline }: { rows: State[]; t: Messages; baseline: boolean }) {
  if (!rows.length) return <Empty t={t} />;
  const width = 760, height = 510, left = 95, right = 25, top = 26, bottom = 74;
  const xMax = Math.max(1, ...rows.map(row => row.sales)) * 1.12;
  const min = Math.min(0, ...rows.map(row => row.profit));
  const max = Math.max(0, ...rows.map(row => row.profit));
  const range = max-min || 1;
  const yMin = min-range*.2, yMax = max+range*.1;
  const x = (value: number) => left + value / xMax * (width-left-right);
  const y = (value: number) => top + (yMax-value) / (yMax-yMin) * (height-top-bottom);
  const zero = y(0);
  const names = baseline ? ["Texas","Pennsylvania","North Carolina"] : [];
  const offsets: Record<string,[number,number]> = {Texas:[36,10],Pennsylvania:[-12,60],"North Carolina":[-25,14]};
  return <div className="scatter-content" dir="ltr"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t.scatter}>
    {Array.from({length:5},(_,i) => xMax*i/4).map(tick => <g key={tick}><line x1={x(tick)} x2={x(tick)} y1={top} y2={height-bottom} stroke={COLORS.grid}/><text x={x(tick)} y={height-bottom+25} textAnchor="middle" fill={COLORS.muted} fontSize="15">{compactUSD(tick)}</text></g>)}
    {Array.from({length:5},(_,i) => yMin+(yMax-yMin)*i/4).map(tick => <g key={tick}><line x1={left} x2={width-right} y1={y(tick)} y2={y(tick)} stroke={COLORS.grid}/><text x={left-12} y={y(tick)+5} textAnchor="end" fill={COLORS.muted} fontSize="15">{compactUSD(tick)}</text></g>)}
    <line x1={left} x2={width-right} y1={zero} y2={zero} stroke={COLORS.ink} strokeWidth="1.5" strokeDasharray="5 4"/>
    <text x={left-12} y={zero-8} textAnchor="end" fontSize="15" fill={COLORS.ink}>$0</text>
    {rows.map(row => <circle key={row.state} cx={x(row.sales)} cy={y(row.profit)} r="5" fill={row.profit < 0 ? COLORS.loss : COLORS.profit} stroke="#FFFFFF" strokeWidth="1.3"><title>{row.state}: {t.sales} {formatCurrency(row.sales)}, {t.profit} {formatCurrency(row.profit)}</title></circle>)}
    {rows.filter(row => names.includes(row.state)).map(row => {
      const [dx,dy] = offsets[row.state]; const tx=x(row.sales)+dx, ty=y(row.profit)+dy;
      return <g key={row.state}><line x1={x(row.sales)} y1={y(row.profit)} x2={tx} y2={ty-5} stroke={COLORS.loss} /><text x={tx} y={ty} textAnchor={dx<0?"end":"start"} fontSize="15" fontWeight="600" fill={COLORS.ink}>{row.state}</text></g>;
    })}
    <text x={(width+left-right)/2} y={height-12} textAnchor="middle" fontSize="16" fill={COLORS.ink}>{t.salesAxis}</text>
    <text transform={`translate(22,${height/2}) rotate(-90)`} textAnchor="middle" fontSize="16" fill={COLORS.ink}>{t.profitAxis}</text>
  </svg><div className="series-legend"><span><i style={{background:COLORS.profit}} />{t.positiveProfit}</span><span><i style={{background:COLORS.loss}} />{t.loss}</span></div></div>;
}

export function LossTable({ rows, t }: { rows: State[]; t: Messages }) {
  const losses = [...rows].filter(row => row.profit < 0).sort((a,b) => a.profit-b.profit).slice(0,5);
  if (!losses.length) return <p className="empty">{t.noLoss}</p>;
  return <div className="table-scroll"><table><thead><tr><th>{t.state}</th><th>{t.sales}</th><th>{t.profit}</th><th>{t.margin}</th></tr></thead><tbody>{losses.map(row => <tr key={row.state}><th scope="row"><bdi dir="ltr">{row.state}</bdi></th><td><Numeric>{formatCurrency(row.sales)}</Numeric></td><td><Numeric negative>{formatCurrency(row.profit)}</Numeric></td><td><Numeric negative>{formatPercent(row.profit_margin)}</Numeric></td></tr>)}</tbody></table></div>;
}
