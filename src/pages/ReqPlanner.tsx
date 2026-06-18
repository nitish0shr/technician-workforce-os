import React, { useMemo, useState } from "react";
import { LayoutGrid, Table2, Map, Search, AlertTriangle, ChevronRight, Info } from "lucide-react";
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
// Grouped-column headers stay monochrome; the open/close column colors carry meaning.
const FAMILY_HEAD = "bg-canvas text-ink-strong";
const PRIORITY_DOT: Record<string, string> = { Critical: "bg-red-600", Moderate: "bg-amber-500", Limited: "bg-zinc-400" };
// Plain-language key so the recruitment team can read the dense table cold.
const LEGEND: [string, string][] = [
  ["Priority", "Critical / Moderate / Limited hiring need for the area"],
  ["D2C RT · Other RT", "Run-time (utilization) index by channel — higher = busier"],
  ["D2C Vol · Other Vol", "Job volume by channel (Other = B2B / non-D2C)"],
  ["Train", "Technicians currently in training"],
  ["Open", "Positions already posted"],
  ["Reqs", "Recommended new requisitions to OPEN"],
  ["Close", "Requisitions to CLOSE — over-resourced or soft demand"],
];

function Cell({ v, kind }: { v: any; kind?: string }) {
  if (kind === "rt") return <span className="tabular-nums text-ink-muted">{(v ?? 0).toFixed ? v.toFixed(2) : Number(v || 0).toFixed(2)}</span>;
  if (kind === "open") return v > 0 ? <span className="font-semibold tabular-nums text-brand">{v}</span> : <span className="text-ink-faint">–</span>;
  if (kind === "close") return v > 0 ? <span className="font-semibold tabular-nums text-red-600">{v}</span> : <span className="text-ink-faint">–</span>;
  return <span className="tabular-nums text-ink">{v ?? 0}</span>;
}

// One labelled signal cell inside the expanded area detail.
function Sig({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><div className="mb-1 section-label">{label}</div>{children}</div>;
}

// Expanded per-area decision signals — the "is this really a hire, or pause/fix?" layer.
function SignalDetail({ r }: { r: any }) {
  const s = r.signals;
  if (!s) return <div className="px-4 py-3 text-[12px] text-ink-faint">No signals for this area.</div>;
  const trendTone = s.forecast.trend === "Surge ahead" ? "text-amber-700" : s.forecast.trend === "Cooling" ? "text-blue-600" : "text-ink-muted";
  const riskDot = s.license_risk === "High" ? "bg-red-500" : s.license_risk === "Medium" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      {/* Why this priority — the reasoning behind the verdict */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line-soft px-5 py-3">
        <span className="text-[12.5px] font-semibold text-ink">{r.priority_reason}</span>
        {(r.priority_factors || []).map((f: string, i: number) => <span key={i} className="chip">{f}</span>)}
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-3 lg:grid-cols-6">
      <Sig label="Forward demand · 6 wk">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[18px] font-semibold tabular-nums text-ink">{s.forecast.projected_vol}</span>
          <span className={cx("text-[11.5px] font-medium", trendTone)}>{s.forecast.pct >= 0 ? `+${s.forecast.pct}` : s.forecast.pct}%</span>
        </div>
        <div className="text-[11px] text-ink-faint">{s.forecast.trend} · now {s.forecast.current_vol}</div>
      </Sig>
      <Sig label="Trainee yield">
        {s.trainees > 0 ? (
          <>
            <div className="text-[18px] font-semibold tabular-nums text-ink">{s.effective_pipeline}<span className="text-[12px] font-normal text-ink-faint"> of {s.trainees}</span></div>
            <div className="text-[11px] text-ink-faint">{Math.round(s.grad_rate * 100)}% grad · ready ~{s.trainee_eta_weeks} wk</div>
          </>
        ) : <div className="text-[14px] text-ink-faint">No trainees</div>}
      </Sig>
      <Sig label="Run-time vs LY">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[18px] font-semibold tabular-nums text-ink">{s.yoy.rt_now}</span>
          <span className={cx("text-[11.5px] font-medium", s.yoy.dir === "up" ? "text-red-600" : s.yoy.dir === "down" ? "text-emerald-600" : "text-ink-muted")}>{s.yoy.dir === "up" ? "▲" : s.yoy.dir === "down" ? "▼" : "–"} {s.yoy.rt_ly}</span>
        </div>
        <div className="text-[11px] text-ink-faint">vs last year</div>
      </Sig>
      <Sig label="Territory">
        <div className="text-[15px] font-medium text-ink">{s.territory}</div>
        <div className="text-[11px] text-ink-faint">service density</div>
      </Sig>
      <Sig label="Licensing risk">
        {s.license_risk ? (
          <div className="inline-flex items-center gap-1.5"><span className={cx("h-1.5 w-1.5 rounded-full", riskDot)} /><span className="text-[15px] font-medium text-ink">{s.license_risk}</span></div>
        ) : <div className="text-[14px] text-ink-faint">n/a</div>}
        <div className="text-[11px] text-ink-faint">HVAC deployability</div>
      </Sig>
      <Sig label="B2B / Other share">
        <div className="text-[18px] font-semibold tabular-nums text-ink">{s.b2b_share}%</div>
        <div className="text-[11px] text-ink-faint">of total volume</div>
      </Sig>
      </div>
    </div>
  );
}

export default function ReqPlanner() {
  const { data, loading, error, reload } = useAsync<any>(() => api.reqPlanner(), []);
  const [q, setQ] = useState("");
  const [excludeUnion, setExcludeUnion] = useState(true);
  const [view, setView] = useState<"table" | "map">("table");
  const [family, setFamily] = useState<string>("All");
  const [openRow, setOpenRow] = useState<number | null>(null);

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
  const colCount = 4 + shownFamilies.reduce((s: number, fam: string) => s + colsFor(fam).length, 0);
  const needReqs = rows.filter((r: any) => r.reqs_open_total > 0).length;
  const st = data.signal_totals;

  return (
    <div>
      <PageHeader
        eyebrow="Hiring control"
        title="Req Planner"
        description="Requisitions to open and close for every planning area, by skill type — driven by channel-split demand (run-time + volume) against current capacity."
      />

      {/* Totals banner — one ink panel, the single high-contrast element on the page.
          Asymmetric: the hero number (total to open) anchors the left; the family
          breakdown sits to the right, separated by hairlines, never centered. */}
      <div className="mb-5 overflow-hidden rounded-xl bg-ink">
        <div className="grid gap-px bg-white/[0.07] sm:grid-cols-[1.3fr_2fr]">
          <div className="bg-ink px-6 py-5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/45">Total reqs to open</div>
            <div className="mt-2.5 flex items-end gap-3">
              <span className="text-[52px] font-semibold leading-[0.9] tracking-[-0.035em] tabular-nums text-white">{data.total_to_open}</span>
              <span className="mb-1.5 text-[12.5px] text-white/55">{data.total_to_close} to close</span>
            </div>
            <div className="mt-2.5 text-[12px] text-white/45">across {data.summary.areas} planning areas</div>
          </div>
          <div className="grid gap-px bg-white/[0.07]" style={{ gridTemplateColumns: `repeat(${families.length}, minmax(0,1fr))` }}>
            {families.map((fam) => (
              <div key={fam} className="bg-ink px-5 py-5">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/45">{fam}</div>
                <div className="mt-2.5 text-[30px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-white">{data.totals[fam].open}</div>
                <div className="mt-1.5 text-[11px] text-white/45">{data.totals[fam].close} to close</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Headcount planning status — restrained strip; the dot carries severity, the
          numbers stay ink. No tinted icon box. */}
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-ink-faint" />
          <span className="text-[13px] font-semibold text-ink">Headcount planning status</span>
        </div>
        <span className="text-[12.5px] text-ink-muted">{data.summary.critical} critical · {data.summary.moderate} moderate priority areas need attention</span>
        <div className="ml-auto flex items-center gap-6">
          <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /><span className="text-[17px] font-semibold tabular-nums text-ink">{data.summary.critical}</span><span className="text-[11px] text-ink-faint">critical</span></div>
          <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /><span className="text-[17px] font-semibold tabular-nums text-ink">{data.summary.moderate}</span><span className="text-[11px] text-ink-faint">moderate</span></div>
        </div>
      </div>

      {/* Forward signals — the pause/hold context the raw req counts don't show. */}
      {st && (
        <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[12px] text-ink-muted">
          <span className="section-label">Forward signals</span>
          <span><span className="font-semibold tabular-nums text-ink">{st.surge_areas}</span> areas surging (6-wk)</span>
          <span><span className="font-semibold tabular-nums text-ink">{st.effective_pipeline}</span> trainees expected to graduate</span>
          <span><span className="font-semibold tabular-nums text-ink">{st.license_risk_areas}</span> HVAC licensing risk</span>
          <span><span className="font-semibold tabular-nums text-ink">{st.rural_areas}</span> rural territories</span>
          <span className="text-ink-faint">· click any row for area signals</span>
        </div>
      )}

      {/* Skill-family tabs */}
      <div className="mb-3 inline-flex flex-wrap rounded-lg border border-line bg-canvas p-0.5">
        {["All", ...families].map((f) => (
          <button key={f} onClick={() => setFamily(f)} className={cx("rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-colors duration-150 ease-out", family === f ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink")}>
            {f === "All" ? "All skills" : f}{f !== "All" && data.totals[f] ? <span className="ml-1.5 text-ink-faint">{data.totals[f].open}</span> : null}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-line bg-canvas p-0.5">
          <button onClick={() => setView("table")} className={cx("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150 ease-out", view === "table" ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink")}><Table2 className="h-3.5 w-3.5" /> Table</button>
          <button onClick={() => setView("map")} className={cx("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150 ease-out", view === "map" ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink")}><Map className="h-3.5 w-3.5" /> Map</button>
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
        <>
        <details className="mb-3 rounded-xl border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[12.5px] font-medium text-ink-muted [&::-webkit-details-marker]:hidden">
            <Info className="h-3.5 w-3.5 text-ink-faint" /> Column legend
          </summary>
          <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 border-t border-line-soft px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
            {LEGEND.map(([term, def]) => (
              <div key={term} className="flex flex-col gap-0.5">
                <span className="text-[11.5px] font-semibold text-ink">{term}</span>
                <span className="text-[11.5px] leading-snug text-ink-faint">{def}</span>
              </div>
            ))}
          </div>
        </details>
        <div className="overflow-auto rounded-xl border border-line bg-surface shadow-card" style={{ maxHeight: "62vh" }}>
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-canvas">
                {["Code", "Name", "Zip", "Priority"].map((h) => (
                  <th key={h} rowSpan={2} className="sticky left-0 border-b border-line px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">{h}</th>
                ))}
                {shownFamilies.map((fam) => (
                  <th key={fam} colSpan={colsFor(fam).length} className={cx("border-b border-l border-line px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide", FAMILY_HEAD)}>{fam}</th>
                ))}
              </tr>
              <tr className="bg-canvas">
                {shownFamilies.flatMap((fam) => colsFor(fam).map((c, i) => (
                  <th key={fam + c.key} className={cx("border-b border-line px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide", i === 0 && "border-l", c.kind === "open" ? "text-brand" : c.kind === "close" ? "text-red-600" : "text-ink-faint")}>{c.label}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const open = openRow === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <tr onClick={() => setOpenRow(open ? null : r.id)} className={cx("cursor-pointer border-b border-line-soft row-hover", open && "bg-surface-hover/60")}>
                      <td className={cx("sticky left-0 px-3 py-2 font-mono text-[11.5px] text-ink-muted", open ? "bg-surface-hover" : "bg-surface")}>
                        <span className="inline-flex items-center gap-1.5"><ChevronRight className={cx("h-3.5 w-3.5 text-ink-faint transition-transform", open && "rotate-90")} />{r.code}</span>
                      </td>
                      <td className={cx("px-3 py-2", open ? "bg-surface-hover" : "bg-surface")}><div className="font-medium text-ink">{r.name}</div><div className="text-[10.5px] text-ink-faint">{r.region}{r.is_union_pr ? " · Union/PR" : ""}</div></td>
                      <td className={cx("px-3 py-2 tabular-nums text-ink-muted", open ? "bg-surface-hover" : "bg-surface")}>{r.zip}</td>
                      <td className={cx("px-3 py-2", open ? "bg-surface-hover" : "bg-surface")}><Pill dot={PRIORITY_DOT[r.priority]}>{r.priority}</Pill></td>
                      {shownFamilies.flatMap((fam) => colsFor(fam).map((c, i) => {
                        const fm = r.byFamily[fam];
                        return (
                          <td key={fam + c.key} className={cx("px-3 py-2 text-right", i === 0 && "border-l border-line-soft")}>
                            {fm ? <Cell v={fm[c.key]} kind={c.kind} /> : <span className="text-ink-faint">–</span>}
                          </td>
                        );
                      }))}
                    </tr>
                    {open && (
                      <tr className="border-b border-line">
                        <td colSpan={colCount} className="bg-canvas p-0"><SignalDetail r={r} /></td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
