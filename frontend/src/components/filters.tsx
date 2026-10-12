"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import type { DashboardFilters, MetadataResponse } from "@/lib/api";
import type { Messages } from "@/lib/i18n";
import { filterKey } from "@/lib/presentation";

type ListKey = "regions" | "segments" | "categories" | "subcategories" | "states";

function MultiSelect({ label, values, options, onChange, t }: {
  label: string; values: string[]; options: string[]; onChange: (values: string[]) => void; t: Messages;
}) {
  const [search, setSearch] = useState("");
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && root.current && !root.current.contains(event.target)) root.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  return <details ref={root} className="selector" onKeyDown={event => {
    if (event.key === "Escape" && root.current) { root.current.open = false; root.current.querySelector("summary")?.focus(); }
  }}>
    <summary aria-label={label}><span className="selector-label">{label}</span><span className="selector-value">{values.length ? values.join(", ") : t.all}</span><ChevronDown size={16} aria-hidden /></summary>
    <div className="selector-panel"><label className="search-label"><span>{t.search} · {label}</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label className="check-option"><input type="checkbox" checked={!values.length} onChange={() => onChange([])} />{t.all}</label>
      <div className="options">{options.filter(option => option.toLowerCase().includes(search.toLowerCase())).map(option => <label key={option} className="check-option"><input type="checkbox" checked={values.includes(option)} onChange={event => onChange(event.target.checked ? [...values, option] : values.filter(value => value !== option))} /><bdi dir="ltr">{option}</bdi></label>)}</div>
    </div>
  </details>;
}

export function Filters({ metadata, draft, applied, setDraft, apply, reset, busy, t }: {
  metadata: MetadataResponse; draft: DashboardFilters; applied: DashboardFilters;
  setDraft: (filters: DashboardFilters) => void; apply: () => void; reset: () => void; busy: boolean; t: Messages;
}) {
  const pending = filterKey(draft) !== filterKey(applied);
  const invalid = Boolean(draft.date_from && draft.date_to && draft.date_from > draft.date_to);
  const update = (key: ListKey, values: string[]) => setDraft({ ...draft, [key]: values });
  const listDefinitions: Array<[ListKey, string, string[]]> = [
    ["segments",t.segment,metadata.segments],["categories",t.category,metadata.categories],
    ["subcategories",t.subcategory,metadata.subcategories],["states",t.state,metadata.states.map(row => row.state)],
  ];
  const chipDimensions: Array<[string,string[],(value:string)=>void]> = [
    [t.year,draft.years.map(String),value => setDraft({...draft, years:draft.years.filter(year => String(year)!==value)})],
    [t.region,draft.regions,value => update("regions",draft.regions.filter(row => row!==value))],
    ...listDefinitions.map(([key,label]) => [label,draft[key],(value:string) => update(key,draft[key].filter(row => row!==value))] as [string,string[],(value:string)=>void]),
  ];
  const moreFilters = useRef<HTMLDetailsElement>(null);
  const closeMoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPointerType = useRef("");
  useEffect(() => () => {
    if (closeMoreTimer.current) clearTimeout(closeMoreTimer.current);
  }, []);
  const keepMoreOpen = () => {
    if (closeMoreTimer.current) clearTimeout(closeMoreTimer.current);
    if (moreFilters.current) moreFilters.current.open = true;
  };
  const closeMoreSoon = () => {
    // چند میلی‌ثانیه فرصت می‌دهیم تا موس از کلید به پنل برسد.
    closeMoreTimer.current = setTimeout(() => {
      if (moreFilters.current) moreFilters.current.open = false;
    }, 140);
  };
  return <form className="filter-bar" onSubmit={event => {
    event.preventDefault();
    if (!invalid) {
      apply();
      if (moreFilters.current) moreFilters.current.open = false;
    }
  }}>
    <div className="filter-main">
      <MultiSelect label={t.year} values={draft.years.map(String)} options={metadata.years.map(String)} onChange={values => setDraft({...draft,years:values.map(Number)})} t={t} />
      <MultiSelect label={t.region} values={draft.regions} options={metadata.regions} onChange={values => update("regions",values)} t={t} />
      <details ref={moreFilters} className="more-filters" onPointerEnter={keepMoreOpen} onPointerLeave={closeMoreSoon} onMouseEnter={keepMoreOpen} onMouseLeave={closeMoreSoon}><summary className="button" onPointerDown={event => { lastPointerType.current = event.pointerType; }} onClick={event => {
        // در رایانه، باز و بسته‌شدن با حرکت موس کنترل می‌شود؛ کلیک برای موبایل و صفحه‌کلید باقی می‌ماند.
        if (event.detail > 0 && lastPointerType.current === "mouse") event.preventDefault();
      }}><SlidersHorizontal size={16} aria-hidden />{t.more}<ChevronDown size={16} aria-hidden /></summary><fieldset className="more-panel"><legend>{t.more}</legend>
        <label className="date-field">{t.startDate}<input dir="ltr" type="date" value={draft.date_from ?? ""} onChange={event => setDraft({...draft,date_from:event.target.value || null})} aria-invalid={invalid} /></label>
        <label className="date-field">{t.endDate}<input dir="ltr" type="date" value={draft.date_to ?? ""} onChange={event => setDraft({...draft,date_to:event.target.value || null})} aria-invalid={invalid} /></label>
        {listDefinitions.map(([key,label,options]) => <MultiSelect key={key} label={label} options={options} values={draft[key]} onChange={values=>update(key,values)} t={t} />)}
      </fieldset></details>
      <button className="button primary" type="submit" disabled={busy || invalid}>{t.apply}</button>
      <button className="button" type="button" onClick={reset} disabled={busy}>{t.reset}</button>
    </div>
    <div className="filter-chips">
      {chipDimensions.flatMap(([label,values,remove]) => values.map(value => <span className="chip" key={label+value}><span>{label}: <bdi>{value}</bdi></span><button type="button" onClick={()=>remove(value)} aria-label={`${t.remove} ${label}: ${value}`}><X size={14} aria-hidden /></button></span>))}
      {(["date_from","date_to"] as const).filter(key=>draft[key]).map(key=><span className="chip" key={key}>{key==="date_from"?t.startDate:t.endDate}: <bdi dir="ltr">{draft[key]}</bdi><button type="button" onClick={()=>setDraft({...draft,[key]:null})} aria-label={`${t.remove} ${key==="date_from"?t.startDate:t.endDate}`}><X size={14} aria-hidden /></button></span>)}
    </div>
    {pending && <p className="pending" role="status">{t.pending}</p>}
    {invalid && <p className="negative" role="alert">{t.dateError}</p>}
  </form>;
}
