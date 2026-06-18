import React, { useMemo, useState } from "react";
import { LayoutGrid, Table2, Map, Search, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { PageHeader } from "../components/page";
import { Loading, ErrorState, Pill } from "../components/primitives";
import { classNames as cx } from "../lib/format";

// Column set per skill family. T2 splits demand by channel (D2C / Other); the rest don't.
const FAMILY_COLS: Record<string, { key: string; label: string; kind?: string }[]> = {
  T2: [
    { key: "d2c_rt", label: "D2C RT", kind: "rt" }, { key: "other_rt", label: "Other RT", kind: "rt" },
    { key: "d2c_vol", label: "D2C Vol" }, { key: "other_vol", label: "Other Vol" },
    { key: "in_training", label: "Train" }, { key: "open_positions", label: "Open" },
    { key: "reqs_to_open", label: "Reqs", kind: "open" }, { key: "reqs_to_close", label: "Close", kind: "close" },
  ],
};
const DEFAULT_COLS = [
  { key: "d2c_rt", label: "RT", kind: "rt" }, { key: "d2c_vol", label: "Vol" },
  { key: "in_training", label: "Train" }, { key: "open_positions", label: "Open" },
  { key: "reqs_to_open", label: "Reqs", kind: "open" }, { key: "reqs_to_close", label: "Close", kind: "close" },
];
const colsFor = (fam: string) => FAMILY_COLS[fam] || DEFAULT_COLS;
const FAMILY_TINT: Record<string, string> = { T2: "bg-indigo-50 text-indigo-700", HVAC: "bg-amber-50 text-amber-700", T1: "bg-sky-50 text-sky-700", "1099": "bg-violet-50 text-violet-700" };
const PRIORITY_DOT: Record<string, string> = { Critical: "bg-red-600", Moderate: "bg-amber-500", Limited: "bg-zinc-400" };

function Cell({ v, kind }: { v: any; kind?: string }) {
  if (kind === "rt") return <span className="tabular-nums text-ink-muted">{(v ?? 0).toFixed ? v.toFixed(2) : Number(v || 0).toFixed(2)}</span>;
  if (kind === "open") return v > 0 ? <span className="font-semibold tabular-nums text-brand">{v}</span> : <span className="text-ink-faint">–</span>;
  if (kind === "close") return v > 0 ? <span className="font-semibold tabular-nums text-red-600">{v}</span> : <span className="text-ink-faint">–</span>;
  return <span className="tabular-nums text-ink">{v ?? 0}</span>;
}

export default function ReqPlanner() {
  const { data, loading, error, reload } = useAsync<any>(() => api.reqPlanner(), []);
  const [q, setQ] = useState("");
  const [excludeUnion, setExcludeUnion] = useState(true);
  const [view, setView] = useState<"table" | "map">("table");
  const [family, setFamily] = useState<string>("All");

  const rows = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    let rs = data.rows.filter((r: any) =>
      (!excludeUnion || !r.is_union_pr) &&
      (!term || `${r.code} ${r.name} ${r.zip} ${r.region}`.toLowerCase().includes(term))
    );
    if (family !== "All") {
      rs = rs.filter((r: any) => r.byFamily[family]);
      rs = [...rs].sort((a: any, b: any) => (b.byFamily[family]?.reqs_to_open || 0) - (a.byFamily[family]?.reqs_to_open || 0));
    }
    return rs;
  }, [data, q, excludeUnion, family]);

  if (loading) return <Loading label="Planning requisitions by area" />;
  if (error || !data) return <ErrorState message={error || "No data"} retry={reload} />;

  const families: string[] = data.families;
  const shownFamilies = family === "All" ? families : [family];
  const needReqs = rows.filter((r: any) => r.reqs_open_total > 0).length;

  return (
    <div>
      <PageHeader
        title="Req Planner"
        description="Requisitions to open and close for every planning area, by skill type — driven by channel-split demand (run-time + volume) against current capacity."
      />

      {/* Totals banner */}
      <div className="mb-4 grid grid-cols-2 divide-x divide-white/10 overflow-hidden rounded-xl bg-slate-900 text-white sm:grid-cols-4 lg:grid-cols-5">
        <div className="px-5 py-4">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">Total recommended reqs</div>
          <div className="mt-1 text-[13px] text-slate-300">across {data.summary.areas} planning areas</div>
        </div>
        {families.map((fam) => (
          <div key={fam} className="px-5 py-4 text-center">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">{fam} Reqs</div>
            <div className="mt-1 text-[28px] font-bold tabular-nums">{data.totals[fam].open}</div>
            <div className="text-[11px] text-slate-400">{data.totals[fam].close} to close</div>
          </div>
        ))}
        <div className="px-5 py-4 text-center">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">Total to open</div>
          <div className="mt-1 text-[28px] font-bold tabular-nums text-emerald-300">{data.total_to_open}</div>
          <div className="text-[11px] text-slate-400">{data.total_to_close} to close</div>
        </div>
      </div>

      {/* Headcount planning status */}
      <div className="mb-4 flex items-center gap-4 rounded-xl border-l-4 border-red-500 border-y border-r border-line bg-surface px-4 py-3.5 shadow-card">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600"><AlertTriangle className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-ink">Headcount Planning Status</div>
          <div className="text-[12.5px] text-ink-muted">{data.summary.critical} critical, {data.summary.moderate} moderate priority areas need attention</div>
        </div>
        <div className="text-center"><div className="text-[20px] font-bold tabular-nums text-red-600">{data.summary.critical}</div><div className="text-[10.5px] text-ink-faint">Critical</div></div>
        <div className="text-center"><div className="text-[20px] font-bold tabular-nums text-amber-600">{data.summary.moderate}</div><div className="text-[10.5px] text-ink-faint">Moderate</div></div>
      </div>

      {/* Skill-family tabs */}
      <div className="mb-3 inline-flex flex-wrap rounded-lg border border-line bg-surface p-0.5">
        {["All", ...families].map((f) => (
          <button key={f} onClick={() => setFamily(f)} className={cx("rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-colors", family === f ? "bg-surface-hover text-ink shadow-card" : "text-ink-muted hover:text-ink")}>
            {f === "All" ? "All skills" : f}{f !== "All" && data.totals[f] ? <span className="ml-1.5 text-ink-faint">{data.totals[f].open}</span> : null}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          <button onClick={() => setView("table")} className={cx("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors", view === "table" ? "bg-surface-hover text-ink shadow-card" : "text-ink-muted hover:text-ink")}><Table2 className="h-3.5 w-3.5" /> Table</button>
          <button onClick={() => setView("map")} className={cx("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors", view === "map" ? "bg-surface-hover text-ink shadow-card" : "text-ink-muted hover:text-ink")}><Map className="h-3.5 w-3.5" /> Map</button>
        </div>
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input className="input pl-8" placeholder="Filter by area, code, or zip…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-muted">
          <input type="checkbox" checked={excludeUnion} onChange={(e) => setExcludeUnion(e.target.checked)} /> Exclude Union/PR
        </label>
        <div className="ml-auto text-[12px] text-ink-faint">{needReqs} areas need requisitions · {rows.length} of {data.summary.areas} areas</div>
      </div>

      {view === "map" ? (() => {
        const openOf = (r: any) => (family === "All" ? r.reqs_open_total : r.byFamily[family]?.reqs_to_open || 0);
        const regions: Record<string, { areas: any[]; open: number }> = {};
        for (const r of rows) { const g = (regions[r.region] = regions[r.region] || { areas: [], open: 0 }); g.areas.push(r); g.open += openOf(r); }
        const list = Object.entries(regions).sort((a, b) => b[1].open - a[1].open);
        const tile = (p: string) => p === "Critical" ? "bg-red-500 text-white" : p === "Moderate" ? "bg-amber-400 text-amber-950" : "bg-zinc-200 text-ink-faint";
        return (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-muted">
              <span className="font-medium text-ink">Req demand by region{family !== "All" ? ` · ${family}` : ""}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Critical</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Moderate</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-zinc-200" /> Limited</span>
              <span className="ml-auto text-ink-faint">Each tile is a planning area; number = reqs to open</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {list.map(([region, g]) => (
                <div key={region} className="card p-3.5">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink">{region}</span>
                    <span className="text-[12px] text-ink-muted"><b className="text-brand tabular-nums">{g.open}</b> reqs · {g.areas.length} areas</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[...g.areas].sort((a, b) => openOf(b) - openOf(a)).map((a) => (
                      <span key={a.id} title={`${a.name} ${a.zip} — ${openOf(a)} reqs to open (${a.priority})`}
                        className={cx("grid h-6 min-w-[22px] cursor-default place-items-center rounded-sm px-1 text-[10px] font-semibold tabular-nums", tile(a.priority))}>
                        {openOf(a) || ""}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })() : (
        <div className="overflow-auto rounded-xl border border-line bg-surface shadow-card" style={{ maxHeight: "62vh" }}>
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-canvas">
                {["Code", "Name", "Zip", "Priority"].map((h) => (
                  <th key={h} rowSpan={2} className="sticky left-0 border-b border-line px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">{h}</th>
                ))}
                {shownFamilies.map((fam) => (
                  <th key={fam} colSpan={colsFor(fam).length} className={cx("border-b border-l border-line px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide", FAMILY_TINT[fam] || "bg-surface-hover text-ink-muted")}>{fam}</th>
                ))}
              </tr>
              <tr className="bg-canvas">
                {shownFamilies.flatMap((fam) => colsFor(fam).map((c, i) => (
                  <th key={fam + c.key} className={cx("border-b border-line px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide", i === 0 && "border-l", c.kind === "open" ? "text-brand" : c.kind === "close" ? "text-red-600" : "text-ink-faint")}>{c.label}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-b border-line-soft last:border-0 row-hover">
                  <td className="sticky left-0 bg-surface px-3 py-2 font-mono text-[11.5px] text-ink-muted">{r.code}</td>
                  <td className="bg-surface px-3 py-2"><div className="font-medium text-ink">{r.name}</div><div className="text-[10.5px] text-ink-faint">{r.region}{r.is_union_pr ? " · Union/PR" : ""}</div></td>
                  <td className="bg-surface px-3 py-2 tabular-nums text-ink-muted">{r.zip}</td>
                  <td className="bg-surface px-3 py-2"><Pill dot={PRIORITY_DOT[r.priority]}>{r.priority}</Pill></td>
                  {shownFamilies.flatMap((fam) => colsFor(fam).map((c, i) => {
                    const fm = r.byFamily[fam];
                    return (
                      <td key={fam + c.key} className={cx("px-3 py-2 text-right", i === 0 && "border-l border-line-soft")}>
                        {fm ? <Cell v={fm[c.key]} kind={c.kind} /> : <span className="text-ink-faint">–</span>}
                      </td>
                    );
                  }))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
