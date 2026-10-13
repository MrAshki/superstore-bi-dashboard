"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { getDashboard, getHealth, getMetadata, type DashboardFilters, type DashboardResponse, type Language, type MetadataResponse } from "@/lib/api";
import { captureReports, type ReportImage } from "@/lib/export";
import { getMessages } from "@/lib/i18n";
import { filterKey, freshFilters, isBaseline, reportingPeriod } from "@/lib/presentation";
import { resolveMonthlyObservations, type MonthlyObservation } from "@/lib/monthly";
import { Filters } from "./filters";
import { Numeric } from "./charts";
import { Reports } from "./reports";
import { Geography, Overview, Products, Profitability, type ViewId } from "./views";

export function Dashboard() {
  const [language,setLanguage]=useState<Language>("fa");
  const [view,setView]=useState<ViewId>("overview");
  const [metadata,setMetadata]=useState<MetadataResponse|null>(null);
  const [data,setData]=useState<DashboardResponse|null>(null);
  const [draft,setDraft]=useState<DashboardFilters>(freshFilters);
  const [monthly,setMonthly]=useState<MonthlyObservation[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [connectionError,setConnectionError]=useState(false);
  const [exporting,setExporting]=useState(false);
  const [exportError,setExportError]=useState(false);
  const [images,setImages]=useState<ReportImage[]>([]);
  const controller=useRef<AbortController|null>(null);
  const generation=useRef(0);
  const cache=useRef(new Map<string,DashboardResponse>());
  const objectUrls=useRef<string[]>([]);
  const t=getMessages(language);
  const applied=data?.applied_filters ?? freshFilters();

  const request=useCallback(async(filters:DashboardFilters,signal:AbortSignal)=>{
    const key=filterKey(filters);
    const cached=cache.current.get(key);
    if(cached) return cached;
    const result=await getDashboard(filters,signal);
    cache.current.set(key,result);
    return result;
  },[]);

  const load=useCallback(async(filters:DashboardFilters,initial=false)=>{
    controller.current?.abort();
    const abort=new AbortController(); controller.current=abort;
    const version=++generation.current;
    setLoading(true);setError(null);setImages([]);
    objectUrls.current.forEach(url=>URL.revokeObjectURL(url));objectUrls.current=[];
    try {
      if(initial) {
        const [meta]=await Promise.all([getMetadata(abort.signal),getHealth(abort.signal)]);
        if(version!==generation.current) return;
        setMetadata(meta);setConnectionError(false);
      }
      const result=await request(filters,abort.signal);
      const observedMonths=await resolveMonthlyObservations(result,abort.signal,request);
      // پاسخ قبلی نمی‌تواند نتیجهٔ یک انتخاب جدید را روی صفحه بازنویسی کند.
      if(version!==generation.current || abort.signal.aborted) return;
      setData(result);setMonthly(observedMonths);setConnectionError(false);
    } catch(caught) {
      if(abort.signal.aborted || version!==generation.current) return;
      setError(caught instanceof Error?caught.message:"Request failed");setConnectionError(true);setData(null);
    } finally {
      if(version===generation.current && !abort.signal.aborted) setLoading(false);
    }
  },[request]);

  useEffect(()=>{
    let active=true;
    queueMicrotask(()=>{if(active) void load(freshFilters(),true);});
    return ()=>{active=false;controller.current?.abort();objectUrls.current.forEach(url=>URL.revokeObjectURL(url));};
  },[load]);
  useEffect(()=>{
    document.documentElement.lang=language;document.documentElement.dir=language==="fa"?"rtl":"ltr";
  },[language]);

  const exportReport=async()=>{
    setExporting(true);setExportError(false);
    try {
      const result=await captureReports();
      objectUrls.current.forEach(url=>URL.revokeObjectURL(url));
      objectUrls.current=result.map(image=>image.url);setImages(result);
    } catch {setExportError(true);}
    finally {setExporting(false);}
  };
  const disabled=loading||exporting;
  return <main className="dashboard" dir={language==="fa"?"rtl":"ltr"}>
    <header className="header"><div><h1>{t.title}</h1><p className="reporting-period">{t.period}: <Numeric>{reportingPeriod(applied,metadata)}</Numeric></p></div>
      <div className="header-actions">
        {connectionError&&<span className="connection-error" role="status" title={t.connectionError}><span/> {t.connection}</span>}
        <div className="language-control" aria-label={t.language}><button disabled={exporting} onClick={()=>{setLanguage("fa");setImages([]);}} className={language==="fa"?"active":""} aria-pressed={language==="fa"}>فارسی</button><button disabled={exporting} onClick={()=>{setLanguage("en");setImages([]);}} className={language==="en"?"active":""} aria-pressed={language==="en"}>English</button></div>
        <button className="button primary" onClick={()=>void exportReport()} disabled={!data||disabled}><Download size={18} aria-hidden/>{exporting?t.exporting:t.export}</button>
      </div>
    </header>
    {metadata&&<Filters metadata={metadata} draft={draft} applied={applied} setDraft={setDraft} apply={()=>void load(draft)} reset={()=>{const reset=freshFilters();setDraft(reset);void load(reset,!metadata);}} busy={disabled} t={t}/>}
    <nav className="tabs" aria-label={t.title}>{(["overview","products","profitability","geography"] as const).map(tab=><button key={tab} className={view===tab?"active":""} aria-current={view===tab?"page":undefined} onClick={()=>setView(tab)}>{t[tab]}</button>)}</nav>
    {exportError&&<p className="error-banner" role="alert">{t.exportFailed}</p>}
    {images.length>0&&<section className="download-panel" aria-label={t.reportReady}><p>{t.exportDone}</p>{images.map(image=><a className="button" key={image.filename} href={image.url} download={image.filename}>{t.download} <bdi dir="ltr">{image.filename}</bdi></a>)}</section>}
    {loading?<div className="loading" role="status"><p>{t.loading}</p><div className="skeleton-kpis">{Array.from({length:4},(_,i)=><div key={i}/>)}</div></div>:error?<div className="error-banner" role="alert"><p>{t.error}</p><button className="button" onClick={()=>void load(draft,true)}><RefreshCw size={16} aria-hidden/>{t.retry}</button></div>:data&&<>
      {view==="overview"?<Overview data={data} monthly={monthly} baseline={isBaseline(applied)} t={t}/>:view==="products"?<Products data={data} t={t}/>:view==="profitability"?<Profitability data={data} t={t}/>:<Geography key={filterKey(applied)} data={data} t={t}/>}
      <footer className="page-footer">{t.source}: <bdi dir="ltr">superstore-sales.csv</bdi> · <Numeric>{data.filtered_rows.toLocaleString("en-US")}</Numeric> {t.observations}</footer>
      {metadata&&<Reports data={data} monthly={monthly} filters={applied} metadata={metadata} language={language}/>}
    </>}
  </main>;
}
