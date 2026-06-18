import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Upload, Sparkles, ArrowRight, Maximize2, Filter } from "lucide-react";
import { api, downloadUrl } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { PageHeader } from "../components/page";
import { DataTable, Col } from "../components/DataTable";
import { Disclosure, Modal, Field } from "../components/overlays";
import {
  StatusPill, RiskPill, ModePill, ScoreBar, ScoreRing, Confidence, Loading, ErrorState,
  DemandPill, TrainingPill, GoLivePill, SeverityPill, EmptyState,
} from "../components/primitives";
import { MarketDetail } from "../components/MarketDetail";
import { toast } from "../components/toast";
import { STATUSES, SKILLS, scoreTone } from "../lib/status";
import { num, fmtDate, classNames as cx } from "../lib/format";
import type { Market } from "../lib/types";

export default function MarketReadiness() {
  const { data, loading, error, reload } = useAsync<Market[]>(() => api.markets(), []);
  const [params, setParams] = useSearchParams();
  const [sel, setSel] = useState<number | null>(null);
  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [skill, setSkill] = useState<string>("");
  const [q, setQ] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    const pid = params.get("market");
    if (pid) setSel(Number(pid));
  }, [params]);

  const filtered = useMemo(() => {
    let list = data || [];
    if (statusFilter.length) list = list.filter((m) => statusFilter.includes(m.rec.readiness_status));
    if (skill) list = list.filter((m) => m.skill_type === skill);
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter((m) => `${m.market} ${m.planning_area} ${m.region} ${m.skill_type} ${m.owner}`.toLowerCase().includes(t));
    }
    return list;
  }, [data, statusFilter, skill, q]);

  if (loading) return <Loading label="Loading markets" />;
  if (error || !data) return <ErrorState message={error || "No data"} retry={reload} />;

  const columns: Col<Market>[] = [
    { id: "market", header: "Market", accessor: (m) => m.market, cell: (m) => (
      <div className="min-w-0"><div className="truncate font-medium text-ink">{m.market}</div><div className="truncate text-[11px] text-ink-faint">{m.region}</div></div>
    ) },
    { id: "planning_area", header: "Planning area", accessor: (m) => m.planning_area, cell: (m) => <span className="text-ink-muted">{m.planning_area}</span> },
    { id: "skill_type", header: "Skill", accessor: (m) => m.skill_type, cell: (m) => <span className="chip">{m.skill_type}</span> },
    { id: "readiness", header: "Readiness", accessor: (m) => m.rec.readiness_status, cell: (m) => <StatusPill status={m.rec.readiness_status} /> },
    { id: "mode", header: "Mode", accessor: (m) => m.rec.hiring_mode, cell: (m) => <ModePill mode={m.rec.hiring_mode} /> },
    { id: "readiness_score", header: "Readiness", align: "right", accessor: (m) => m.rec.market_readiness_score, cell: (m) => (
      <div className="flex items-center justify-end gap-2"><div className="hidden w-14 md:block"><ScoreBar value={m.rec.market_readiness_score} tone={scoreTone(m.rec.market_readiness_score)} /></div><span className="w-6 tabular-nums">{m.rec.market_readiness_score}</span></div>
    ) },
    { id: "risk", header: "Risk", align: "right", accessor: (m) => m.rec.risk_score, cell: (m) => <RiskPill level={m.rec.risk_level} score={m.rec.risk_score} /> },
    { id: "confidence", header: "Conf.", align: "right", accessor: (m) => m.rec.confidence_score, cell: (m) => <span className="tabular-nums text-ink-muted">{m.rec.confidence_score}%</span> },
    { id: "gap", header: "Adj. gap", align: "right", accessor: (m) => m.rec.adjusted_staffing_gap ?? -99, cell: (m) => <span className="tabular-nums">{num(m.rec.adjusted_staffing_gap)}</span> },
    { id: "open_reqs", header: "Reqs", align: "right", accessor: (m) => m.open_reqs ?? 0, cell: (m) => <span className="tabular-nums text-ink-muted">{num(m.open_reqs)}</span> },
    { id: "pending_starts", header: "Starts", align: "right", accessor: (m) => m.pending_starts ?? 0, cell: (m) => <span className="tabular-nums text-ink-muted">{num(m.pending_starts)}</span> },
    { id: "owner", header: "Owner", accessor: (m) => m.owner, cell: (m) => <span className="text-[12px] text-ink-muted">{num(m.owner)}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Market Readiness"
        description="Every market scored for where and how aggressively to hire. Select a market for the full recommendation, evidence, and decision history."
        actions={
          <>
            <a className="btn" href={downloadUrl("/export/markets.csv")}><Download className="h-3.5 w-3.5" /> Export CSV</a>
            <button className="btn" onClick={() => setImportOpen(true)}><Upload className="h-3.5 w-3.5" /> Import CSV</button>
          </>
        }
      />

      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input className="input w-56 pl-8" placeholder="Search markets, owners…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-36" value={skill} onChange={(e) => setSkill(e.target.value)}>
          <option value="">All skills</option>
          {SKILLS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="flex flex-wrap items-center gap-1">
          {STATUSES.map((s) => {
            const on = statusFilter.includes(s);
            return (
              <button key={s} onClick={() => setStatusFilter((f) => (on ? f.filter((x) => x !== s) : [...f, s]))}
                className={cx("pill border transition-colors", on ? "border-brand/40 bg-brand/15 text-ink" : "border-line bg-surface-raised text-ink-faint hover:text-ink-muted")}>
                {s}
              </button>
            );
          })}
          {statusFilter.length > 0 && <button className="btn-ghost text-[11px]" onClick={() => setStatusFilter([])}>Clear</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <DataTable
            data={filtered}
            columns={columns}
            search={false}
            initialSort={[{ id: "risk", desc: true }]}
            onRowClick={(m) => { setSel(m.id); setParams({ market: String(m.id) }); }}
            getRowId={(m) => String(m.id)}
            emptyTitle="No markets match your filters"
          />
          <p className="mt-2 text-[11px] text-ink-faint">{filtered.length} of {data.length} markets · click a row for the detail panel</p>
        </div>

        <div className="xl:col-span-5">
          <div className="sticky top-[72px]">
            {sel == null ? (
              <EmptyState icon={<Sparkles className="h-6 w-6" />} title="Select a market" hint="Choose a market on the left to see its recommendation, evidence, alerts, and decision history." />
            ) : (
              <RightPanel id={sel} onOpenFull={() => setDrawerId(sel)} onChanged={reload} />
            )}
          </div>
        </div>
      </div>

      <MarketDetail marketId={drawerId} onClose={() => setDrawerId(null)} onChanged={reload} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); reload(); }} />
    </div>
  );
}

function RightPanel({ id, onOpenFull, onChanged }: { id: number; onOpenFull: () => void; onChanged: () => void }) {
  const { data: m, loading, error } = useAsync<any>(() => api.market(id), [id]);
  if (loading) return <div className="card p-6"><Loading label="Loading detail" /></div>;
  if (error || !m) return <div className="card p-6"><ErrorState message={error || "Not found"} /></div>;
  const rec = m.rec;

  return (
    <div className="card-raised max-h-[calc(100vh-96px)] overflow-y-auto">
      <div className="border-b border-line p-4">
        <div className="mb-1 text-[11px] uppercase tracking-wide text-ink-faint">{m.planning_area} · {m.region}</div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[16px] font-semibold text-ink">{m.market} — {m.skill_type}</h3>
          <button className="btn-ghost text-[12px]" onClick={onOpenFull}><Maximize2 className="h-3.5 w-3.5" /> Full detail</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusPill status={rec.readiness_status} />
          <ModePill mode={rec.hiring_mode} />
          <RiskPill level={rec.risk_level} score={rec.risk_score} />
          <Confidence value={rec.confidence_score} />
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-ink-muted"><Sparkles className="h-4 w-4 text-brand-soft" /><span className="panel-title">Recommendation</span></div>
          <p className="text-[14px] font-semibold text-ink">{rec.recommended_action}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{rec.explanation}</p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[["Readiness", rec.market_readiness_score, false], ["Priority", rec.priority_score, false], ["Risk", rec.risk_score, true], ["Conf.", rec.confidence_score, false]].map(([l, v, inv]: any) => (
            <div key={l} className="flex flex-col items-center gap-1 rounded-lg border border-line bg-surface px-1 py-2">
              <ScoreRing value={v} size={40} tone={scoreTone(v, inv)} />
              <span className="section-label">{l}</span>
            </div>
          ))}
        </div>

        <Disclosure summary="Why this recommendation?" defaultOpen>
          <ul className="space-y-1">
            <li>Adjusted gap <b className="text-ink">{num(rec.adjusted_staffing_gap)}</b> (target − current − starts − offers).</li>
            <li>Demand <b className="text-ink">{rec.demand_status}</b>; training <b className="text-ink">{rec.training_status}</b>; go-live <b className="text-ink">{rec.go_live_status}</b>.</li>
            <li>Risk drivers: {rec.risk_drivers?.join(", ") || "none significant"}.</li>
          </ul>
        </Disclosure>

        <div>
          <div className="mb-2 panel-title text-ink-muted">Evidence</div>
          <div className="flex flex-wrap gap-1.5">
            <DemandPill status={rec.demand_status} />
            <TrainingPill status={rec.training_status} />
            <GoLivePill status={rec.go_live_status} />
            <span className="chip">Work {num(m.actual_work_volume)}</span>
            <span className="chip">Mentor {num(m.mentor_capacity)} (~{num(rec.mentor_support)} starts)</span>
            <span className="chip">Reqs {num(m.open_reqs)} / gap {num(rec.adjusted_staffing_gap)}</span>
            <span className="chip">Attrition {m.attrition_90_days ?? "—"}%</span>
          </div>
        </div>

        {m.alerts?.length > 0 && (
          <div>
            <div className="mb-2 panel-title text-ink-muted">Alerts ({m.alerts.length})</div>
            <div className="space-y-1.5">
              {m.alerts.slice(0, 4).map((a: any, i: number) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-line bg-surface px-2.5 py-2">
                  <SeverityPill sev={a.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] text-ink">{a.explanation}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-faint"><ArrowRight className="h-3 w-3" /> {a.next_step}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {m.exception && (
          <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-3">
            <div className="mb-1 flex items-center gap-2 text-[12px]"><span className="chip text-fuchsia-700">Exception {m.exception.override_status}</span></div>
            <p className="text-[12px] text-ink-muted">{m.exception.exception_reason}</p>
          </div>
        )}

        <button className="btn-primary w-full justify-center" onClick={onOpenFull}>Open full detail & actions <ArrowRight className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

function ImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const r = await api.importMarkets(text);
      toast(`Import complete — ${r.created} created, ${r.updated} updated${r.errors?.length ? `, ${r.errors.length} skipped` : ""}`);
      onDone();
    } catch (e: any) { toast(e.message || "Import failed", "error"); } finally { setBusy(false); }
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => setText(String(r.result || "")); r.readAsText(f);
  }
  return (
    <Modal open={open} onClose={onClose} title="Import markets from CSV" width={620}
      footer={<><a className="btn mr-auto" href={downloadUrl("/template/markets.csv")}><Download className="h-3.5 w-3.5" /> Download template</a><button className="btn" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={run} disabled={busy || !text.trim()}>{busy ? "Importing…" : "Import"}</button></>}>
      <Field label="Upload .csv or paste below" hint="Rows are matched by id, or by market + skill. New markets are created; existing ones are updated. Everything recomputes automatically.">
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-[12px] text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-hover file:px-3 file:py-1.5 file:text-ink" />
      </Field>
      <textarea className="input mt-3 min-h-[180px] font-mono text-[11px]" placeholder="market,skill_type,current_headcount,target_headcount,…" value={text} onChange={(e) => setText(e.target.value)} />
    </Modal>
  );
}
