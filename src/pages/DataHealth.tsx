import React, { useState } from "react";
import { Activity, Database, Clock, AlertCircle, Download } from "lucide-react";
import { api, downloadUrl } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { PageHeader, StatCard } from "../components/page";
import { DataTable, Col } from "../components/DataTable";
import { Loading, ErrorState, ScoreBar } from "../components/primitives";
import { MarketDetail } from "../components/MarketDetail";
import { scoreTone } from "../lib/status";
import { fmtDate, num } from "../lib/format";

const REQUIRED = [
  "Current Headcount", "Target Headcount", "Open Reqs", "Pending Starts", "Actual Work Volume",
  "Forecasted Demand", "Forward Capacity", "Mentor Capacity", "Training Capacity", "Market Priority",
];

export default function DataHealth() {
  const { data, loading, error, reload } = useAsync<any[]>(() => api.dataHealth(), []);
  const [sel, setSel] = useState<number | null>(null);

  if (loading) return <Loading label="Checking data health" />;
  if (error || !data) return <ErrorState message={error || "No data"} retry={reload} />;

  const avg = (k: string) => Math.round(data.reduce((s, d) => s + d[k], 0) / data.length);
  const incomplete = data.filter((d) => d.missing_fields.length > 0);
  const stale = data.filter((d) => d.stale_fields.length > 0);

  const columns: Col<any>[] = [
    { id: "market", header: "Market", accessor: (d) => d.market, cell: (d) => <div><div className="font-medium text-ink">{d.market}</div><div className="text-[11px] text-ink-faint">{d.skill} · {d.planning_area}</div></div> },
    { id: "data_health_score", header: "Data health", align: "right", accessor: (d) => d.data_health_score, cell: (d) => (
      <div className="flex items-center justify-end gap-2"><div className="hidden w-16 md:block"><ScoreBar value={d.data_health_score} tone={scoreTone(d.data_health_score)} /></div><span className="w-9 tabular-nums">{d.data_health_score}%</span></div>
    ) },
    { id: "confidence_score", header: "Confidence", align: "right", accessor: (d) => d.confidence_score, cell: (d) => (
      <div className="flex items-center justify-end gap-2"><div className="hidden w-16 md:block"><ScoreBar value={d.confidence_score} tone={scoreTone(d.confidence_score)} /></div><span className="w-9 tabular-nums">{d.confidence_score}%</span></div>
    ) },
    { id: "missing", header: "Missing fields", accessor: (d) => d.missing_fields.length, cell: (d) => d.missing_fields.length ? (
      <div className="flex flex-wrap gap-1">{d.missing_fields.slice(0, 3).map((f: string) => <span key={f} className="chip"><span className="mr-1 h-[6px] w-[6px] rounded-full bg-red-500" />{f}</span>)}{d.missing_fields.length > 3 && <span className="chip">+{d.missing_fields.length - 3}</span>}</div>
    ) : <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted"><span className="h-[6px] w-[6px] rounded-full bg-emerald-500" />Complete</span> },
    { id: "stale", header: "Stale", accessor: (d) => d.stale_fields.length, cell: (d) => d.stale_fields.length ? <span className="pill"><span className="h-[7px] w-[7px] rounded-full bg-amber-500" />{d.stale_fields[0]}</span> : <span className="text-ink-faint">—</span> },
    { id: "last_updated", header: "Last updated", accessor: (d) => d.last_updated, cell: (d) => <span className="text-ink-muted">{fmtDate(d.last_updated)}</span> },
    { id: "source", header: "Source of truth", accessor: (d) => d.source_of_truth, cell: (d) => <span className="text-[11.5px] text-ink-faint">{d.source_of_truth}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Data Health"
        description="How complete and fresh the inputs are — and therefore how much to trust each recommendation."
        actions={<a className="btn" href={downloadUrl("/export/markets.csv")}><Download className="h-3.5 w-3.5" /> Export data</a>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Avg data health" value={`${avg("data_health_score")}%`} tone="emerald" icon={<Database className="h-4 w-4" />} />
        <StatCard label="Avg confidence" value={`${avg("confidence_score")}%`} tone="sky" icon={<Activity className="h-4 w-4" />} />
        <StatCard label="Markets w/ gaps" value={incomplete.length} tone="rose" icon={<AlertCircle className="h-4 w-4" />} hint="Missing one or more required fields" />
        <StatCard label="Stale records" value={stale.length} tone="amber" icon={<Clock className="h-4 w-4" />} hint="Not updated in 30+ days" />
      </div>

      {incomplete.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-1 flex items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-700" /><span className="text-[13px] font-semibold text-amber-800">Low-confidence recommendations</span></div>
          <div className="space-y-1">
            {incomplete.slice(0, 4).map((d) => (
              <p key={d.id} className="text-[12.5px] text-ink-muted"><span className="font-medium text-ink">{d.market} {d.skill}:</span> {d.confidence_note}</p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="xl:col-span-3">
          <DataTable data={data} columns={columns} initialSort={[{ id: "data_health_score", desc: false }]} searchPlaceholder="Filter markets…" onRowClick={(d) => setSel(d.id)} getRowId={(d) => String(d.id)} />
        </div>
        <div className="card h-fit p-4 xl:col-span-1">
          <div className="mb-2 panel-title text-ink-muted">Required fields</div>
          <p className="mb-3 text-[11.5px] text-ink-faint">Every market should carry these for a fully-confident recommendation:</p>
          <ul className="space-y-1.5">
            {REQUIRED.map((f) => (
              <li key={f} className="flex items-center gap-2 text-[12px] text-ink-muted"><span className="h-1.5 w-1.5 rounded-full bg-brand-soft/60" /> {f}</li>
            ))}
          </ul>
        </div>
      </div>

      <MarketDetail marketId={sel} onClose={() => setSel(null)} onChanged={reload} />
    </div>
  );
}
