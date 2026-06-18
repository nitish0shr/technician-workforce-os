import React, { useState } from "react";
import {
  Sparkles, ClipboardCopy, Megaphone, ShieldAlert, Pencil, CheckCircle2,
  AlertTriangle, Info, ArrowRight, Database, ListChecks, GitBranch,
} from "lucide-react";
import { Drawer, Modal, Field, Disclosure } from "./overlays";
import {
  StatusPill, RiskPill, ModePill, GoLivePill, DemandPill, TrainingPill,
  SeverityPill, ScoreRing, Confidence, Loading, ErrorState, Metric, Divider,
} from "./primitives";
import { Timeline } from "./Timeline";
import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { toast } from "./toast";
import { fmtDate, relTime, num, copyText, classNames as cx } from "../lib/format";
import { scoreTone } from "../lib/status";

export function MarketDetail({ marketId, onClose, onChanged }: { marketId: number | null; onClose: () => void; onChanged?: () => void }) {
  const open = marketId != null;
  const { data: m, loading, error, reload } = useAsync<any>(
    () => (marketId == null ? Promise.resolve(null) : api.market(marketId)),
    [marketId]
  );
  const [editing, setEditing] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [excOpen, setExcOpen] = useState(false);
  const [resolveAlert, setResolveAlert] = useState<any>(null);

  function refresh() { reload(); onChanged?.(); }

  const rec = m?.rec;

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        subtitle={m ? `${m.planning_area} · ${m.region} · ${m.zip_cluster || ""}` : "Market"}
        title={m ? `${m.market} — ${m.skill_type}` : "Loading…"}
        width={620}
        headerExtra={
          m && rec ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill status={rec.readiness_status} />
              <ModePill mode={rec.hiring_mode} />
              <RiskPill level={rec.risk_level} score={rec.risk_score} />
              {rec.part_time_suggested && <span className="chip text-amber-700">Part-time candidate</span>}
              <span className="ml-1"><Confidence value={rec.confidence_score} /></span>
            </div>
          ) : null
        }
        footer={
          m && rec ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-ink-faint">Last updated {fmtDate(m.last_updated)} · owner {num(m.owner)}</span>
              <div className="flex items-center gap-2">
                <button className="btn" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Edit data</button>
                <button className="btn-primary" onClick={() => { copyText(leadershipLine(m)); toast("Market summary copied"); }}><ClipboardCopy className="h-3.5 w-3.5" /> Copy summary</button>
              </div>
            </div>
          ) : null
        }
      >
        {loading && <Loading label="Loading market" />}
        {error && <ErrorState message={error} retry={reload} />}
        {m && rec && (
          <div className="space-y-4 animate-fade-in">
            {/* Recommendation */}
            <section className="card-raised p-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-soft" />
                <span className="panel-title">Recommendation</span>
              </div>
              <p className="text-[15px] font-semibold text-ink">{rec.recommended_action}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{rec.explanation}</p>

              {/* Trust flags — surfaced so a skeptic never has to find these the hard way */}
              {(rec.reference_only || rec.status_conflict || rec.demand_conflict) && (
                <div className="mt-2.5 space-y-1.5">
                  {rec.reference_only && (
                    <FlagBanner tone="slate" icon={<Database className="h-3.5 w-3.5" />} text="Scores shown for reference only — data is too thin to assess this market with confidence." />
                  )}
                  {rec.status_conflict && (
                    <FlagBanner tone="amber" icon={<AlertTriangle className="h-3.5 w-3.5" />} text="This market ranks high on priority but the recommended action is hold/at-risk — reconcile the queue before deciding." />
                  )}
                  {rec.demand_conflict && (
                    <FlagBanner tone="amber" icon={<GitBranch className="h-3.5 w-3.5" />} text="Demand signals disagree sharply — the optimistic reading is not trusted on its own." />
                  )}
                </div>
              )}

              <div className="mt-3">
                <Disclosure summary="Why this recommendation?">
                  <ul className="space-y-1.5">
                    <li><b className="text-ink">Adjusted gap</b> = target {num(m.target_headcount)} − current {num(m.current_headcount)} − pending starts {num(m.pending_starts)} − offers {num(m.pending_offers)} = <b className="text-ink">{num(rec.adjusted_staffing_gap)}</b>.</li>
                    <li><b className="text-ink">Demand</b> is {rec.demand_status}{rec.demand_score != null ? ` (signal ${rec.demand_score}/100)` : ""}, from work volume {num(m.actual_work_volume)}, forecast {num(m.forecasted_demand)}, forward capacity {num(m.forward_capacity)}.</li>
                    <li><b className="text-ink">Training</b> is {rec.training_status}: {num(m.mentor_capacity)} mentor(s) support ~{num(rec.mentor_support)} starts vs {num(m.pending_starts)} pending; training slots {num(m.training_capacity)}.</li>
                    <li><b className="text-ink">Risk</b> {rec.risk_score} ({rec.risk_level}){rec.risk_drivers?.length ? ` — drivers: ${rec.risk_drivers.join(", ")}` : ""}.</li>
                    <li><b className="text-ink">Decision path</b>: {decisionPath(m, rec)}.</li>
                  </ul>
                </Disclosure>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                <ScoreCard label="Readiness" value={rec.market_readiness_score} />
                <ScoreCard label="Priority" value={rec.priority_score} />
                <ScoreCard label="Risk" value={rec.risk_score} invert />
                <ScoreCard label="Confidence" value={rec.confidence_score} />
              </div>
              {rec.contributions && (
                <div className="mt-3">
                  <Disclosure summary="Why these scores? (point-by-point)">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <ScoreBreakdown title="Readiness" parts={rec.contributions.readiness} />
                      <ScoreBreakdown title="Priority" parts={rec.contributions.priority} />
                      <ScoreBreakdown title="Risk" parts={rec.contributions.risk} />
                    </div>
                  </Disclosure>
                </div>
              )}
            </section>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={() => setHandoffOpen(true)}><Megaphone className="h-3.5 w-3.5" /> Create handoff</button>
              <button className="btn" onClick={() => setExcOpen(true)}><ShieldAlert className="h-3.5 w-3.5" /> Request leadership exception</button>
            </div>

            {/* Evidence */}
            <Section icon={<ListChecks className="h-4 w-4" />} title="Evidence">
              <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                <Metric label="Adjusted gap" value={num(rec.adjusted_staffing_gap)} />
                <Metric label="Open reqs" value={num(m.open_reqs)} sub={(m.open_reqs ?? 0) > (rec.adjusted_staffing_gap ?? 0) + 1 ? "possible duplicates" : undefined} />
                <Metric label="Pending starts" value={num(m.pending_starts)} />
                <Metric label="Demand" value={<DemandPill status={rec.demand_status} />} />
                <Metric label="Training" value={<TrainingPill status={rec.training_status} />} />
                <Metric label="Go-live" value={<GoLivePill status={rec.go_live_status} />} />
                <Metric label="Work volume" value={num(m.actual_work_volume)} />
                <Metric label="Forecast demand" value={num(m.forecasted_demand)} />
                <Metric label="Forward capacity" value={num(m.forward_capacity)} />
                <Metric label="Mentor capacity" value={num(m.mentor_capacity)} sub={`supports ~${num(rec.mentor_support)} starts`} />
                <Metric label="Training capacity" value={num(m.training_capacity)} />
                <Metric label="90-day attrition" value={m.attrition_90_days != null ? m.attrition_90_days + "%" : "—"} />
                <Metric label="Recruiter pipeline" value={num(m.recruiter_pipeline_count)} />
                <Metric label="Skill match" value={m.skill_match != null ? m.skill_match + "%" : "—"} />
                <Metric label="Priority" value={num(m.market_priority)} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.is_focus_market ? <span className="chip text-indigo-700">Focus market</span> : null}
                {m.is_union_market ? <span className="chip text-sky-600">Union market</span> : null}
                <span className="chip">{rec.go_live_explanation}</span>
              </div>
            </Section>

            {/* Required next steps */}
            <Section icon={<ArrowRight className="h-4 w-4" />} title="Required next steps">
              <ol className="space-y-1.5">
                {nextSteps(m, rec).map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-ink-muted">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-line text-[10px] text-ink-faint">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </Section>

            {/* Alerts */}
            <Section icon={<AlertTriangle className="h-4 w-4" />} title={`Alerts & risks (${m.alerts.length})`}>
              {m.alerts.length === 0 ? (
                <p className="text-[12.5px] text-ink-faint">No active alerts. This market is clear.</p>
              ) : (
                <div className="space-y-2">
                  {m.alerts.map((a: any, i: number) => (
                    <div key={i} className="rounded-lg border border-line bg-surface-raised/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {a.scope === "risk" ? <ShieldAlert className="h-3.5 w-3.5 text-rose-500" /> : <Info className="h-3.5 w-3.5 text-sky-600" />}
                          <span className="text-[12.5px] font-medium text-ink">{a.risk_type || a.signal_type}</span>
                          <SeverityPill sev={a.severity} />
                        </div>
                        <button className="btn-ghost text-[12px]" onClick={() => setResolveAlert(a)}><CheckCircle2 className="h-3.5 w-3.5" /> Resolve</button>
                      </div>
                      <p className="mt-1 text-[12.5px] text-ink-muted">{a.explanation}</p>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-ink-faint">
                        <span>Owner: <span className="text-ink-muted">{a.owner}</span></span>
                        <span className="inline-flex items-center gap-1"><ArrowRight className="h-3 w-3" /> {a.next_step}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Handoffs */}
            <Section icon={<Megaphone className="h-4 w-4" />} title={`Handoffs (${m.handoffs?.length || 0})`}>
              {m.handoffs?.length ? (
                <div className="space-y-2">
                  {m.handoffs.map((h: any) => (
                    <div key={h.id} className="flex items-center justify-between rounded-lg border border-line bg-surface-raised/50 px-3 py-2">
                      <div>
                        <div className="text-[12.5px] text-ink">{h.handoff_type} <span className="text-ink-faint">· {h.escalation_level}</span></div>
                        <div className="text-[11px] text-ink-faint">{h.owner} · due {fmtDate(h.deadline)}</div>
                      </div>
                      <span className="chip">{h.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12.5px] text-ink-faint">No handoffs yet. Create one if demand support is needed.</p>
              )}
            </Section>

            {/* Leadership exception */}
            <Section icon={<ShieldAlert className="h-4 w-4" />} title="Leadership exception">
              {m.exception ? (
                <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-3 text-[12.5px]">
                  <div className="mb-1 flex items-center gap-2"><span className="chip text-fuchsia-700">{m.exception.override_status}</span><span className="text-ink-faint">risk {m.exception.risk_level}</span></div>
                  <p className="text-ink-muted">{m.exception.exception_reason || "No reason recorded."}</p>
                  <p className="mt-1 text-[11px] text-ink-faint">Requested by {num(m.exception.requested_by)} · approved by {num(m.exception.approved_by)} · review {fmtDate(m.exception.review_date)}</p>
                </div>
              ) : (
                <p className="text-[12.5px] text-ink-faint">No exception on file. {rec.readiness_status === "At Risk" ? "This market is At Risk — request one to continue hiring with documented risk." : ""}</p>
              )}
            </Section>

            {/* Decision history */}
            <Section icon={<GitBranch className="h-4 w-4" />} title="Decision history">
              <Timeline items={historyItems(m)} />
            </Section>

            {/* Raw data */}
            <Disclosure summary={<span className="inline-flex items-center gap-1.5"><Database className="h-3.5 w-3.5" /> Raw data</span>}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
                {RAW_FIELDS.map((f) => (
                  <div key={f} className="flex justify-between gap-2 border-b border-line-soft/60 py-0.5">
                    <span className="text-ink-faint">{f}</span>
                    <span className="text-ink-muted">{num((m as any)[f])}</span>
                  </div>
                ))}
              </div>
            </Disclosure>
          </div>
        )}
      </Drawer>

      {m && <EditMarketModal open={editing} onClose={() => setEditing(false)} market={m} onSaved={() => { setEditing(false); refresh(); }} />}
      {m && <CreateHandoffModal open={handoffOpen} onClose={() => setHandoffOpen(false)} market={m} onSaved={() => { setHandoffOpen(false); refresh(); }} />}
      {m && <RequestExceptionModal open={excOpen} onClose={() => setExcOpen(false)} market={m} onSaved={() => { setExcOpen(false); refresh(); }} />}
      <ResolveAlertModal alert={resolveAlert} market={m} onClose={() => setResolveAlert(null)} onResolved={() => { setResolveAlert(null); refresh(); }} />
    </>
  );
}

/* ----------------------------- helpers ----------------------------- */
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="mb-2.5 flex items-center gap-2 text-ink-muted">
        {icon}
        <span className="panel-title">{title}</span>
      </div>
      {children}
    </section>
  );
}

function ScoreCard({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-line bg-surface px-2 py-2.5">
      <ScoreRing value={value} tone={scoreTone(value, invert)} />
      <span className="section-label">{label}</span>
    </div>
  );
}

const FLAG_TONE: Record<string, string> = {
  slate: "border-slate-200 bg-slate-100 text-slate-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
};
function FlagBanner({ tone, icon, text }: { tone: string; icon: React.ReactNode; text: string }) {
  return (
    <div className={cx("flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] leading-snug", FLAG_TONE[tone] || FLAG_TONE.slate)}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function ScoreBreakdown({ title, parts }: { title: string; parts: { factor: string; points: number }[] }) {
  if (!parts?.length) return (
    <div><div className="section-label mb-1.5">{title}</div><p className="text-[11.5px] text-ink-faint">No contributing factors.</p></div>
  );
  return (
    <div>
      <div className="section-label mb-1.5">{title}</div>
      <ul className="space-y-1">
        {parts.map((p, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-[11.5px]">
            <span className="truncate text-ink-muted">{p.factor}</span>
            <span className={cx("tabular-nums font-medium", p.points < 0 ? "text-rose-600" : "text-ink")}>{p.points > 0 ? "+" : ""}{p.points}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const RAW_FIELDS = [
  "region", "planning_area", "market", "zip_cluster", "skill_type", "current_headcount", "target_headcount",
  "pending_offers", "pending_starts", "next_start_date", "open_reqs", "actual_work_volume", "forecasted_demand",
  "forward_capacity", "mentor_capacity", "training_capacity", "attrition_90_days", "recruiter_pipeline_count",
  "market_priority", "is_union_market", "is_focus_market", "leadership_exception", "owner", "skill_match", "last_updated",
];

function decisionPath(m: any, rec: any) {
  if (rec.readiness_status === "Data Incomplete") return "critical fields missing → validate before deciding";
  if (rec.readiness_status === "Leadership Exception") return "leadership override active → continue per direction, document risk";
  if ((rec.adjusted_staffing_gap ?? 0) <= 0) return "gap at/below target → hold";
  if (rec.risk_level === "High" || rec.risk_level === "Critical") return "risk high/critical → at risk, escalate";
  if (rec.training_status === "Not Ready") return "training not ready → training first";
  if (rec.demand_status === "Low") return "gap exists but demand low → demand first";
  if (rec.demand_status === "Medium") return "gap exists, demand medium → pipeline only";
  return "gap exists, demand high, capacity ok → ready to hire";
}

function nextSteps(m: any, rec: any) {
  const steps = new Set<string>();
  steps.add(rec.recommended_action + ".");
  if (rec.go_live_status === "Blocked") steps.add("Resolve go-live block: " + rec.go_live_explanation);
  if (rec.go_live_status === "Watch") steps.add("Confirm demand and mentor support before the next start.");
  m.alerts.forEach((a: any) => steps.add(a.next_step));
  if (rec.readiness_status === "At Risk") steps.add("Assign a risk owner and decide whether to request a leadership exception.");
  return Array.from(steps).slice(0, 6);
}

function historyItems(m: any) {
  const items: any[] = [];
  (m.decisions || []).forEach((d: any) =>
    items.push({ title: d.decision_type + " — " + (d.decision_summary || ""), meta: fmtDate(d.decision_date), body: `${d.decided_by || ""}${d.reason ? " · " + d.reason : ""}`, tone: "violet" }));
  (m.audit || []).forEach((a: any) => {
    const tone = a.action === "status_change" ? "amber" : a.action === "create" ? "emerald" : "slate";
    items.push({ title: labelAudit(a), meta: relTime(a.changed_at), body: a.reason, tone });
  });
  return items.slice(0, 12);
}
function labelAudit(a: any) {
  if (a.action === "status_change") return `Status ${a.previous_value?.readiness_status || "?"} → ${a.new_value?.readiness_status || "?"}`;
  if (a.action === "update") return "Market data edited";
  if (a.action === "create") return "Market created";
  return a.action;
}
function leadershipLine(m: any) {
  const r = m.rec;
  return `${m.market} ${m.skill_type} — ${r.readiness_status} (${r.hiring_mode}). Gap ${num(r.adjusted_staffing_gap)}, risk ${r.risk_score} ${r.risk_level}, confidence ${r.confidence_score}%. ${r.explanation} Owner: ${num(m.owner)}.`;
}

/* ----------------------------- modals ----------------------------- */
function EditMarketModal({ open, onClose, market, onSaved }: any) {
  const fields: [string, string, string?][] = [
    ["current_headcount", "Current headcount"], ["target_headcount", "Target headcount"],
    ["pending_offers", "Pending offers"], ["pending_starts", "Pending starts"],
    ["open_reqs", "Open reqs"], ["next_start_date", "Next start date", "date"],
    ["actual_work_volume", "Work volume (0-100)"], ["forecasted_demand", "Forecast demand (0-100)"],
    ["forward_capacity", "Forward capacity (0-100)"], ["mentor_capacity", "Mentor capacity"],
    ["training_capacity", "Training capacity"], ["attrition_90_days", "90-day attrition %"],
    ["recruiter_pipeline_count", "Recruiter pipeline"], ["skill_match", "Skill match %"],
  ];
  const [form, setForm] = useState<any>(() => Object.fromEntries(fields.map(([k]) => [k, market[k] ?? ""])));
  const [extra, setExtra] = useState({ market_priority: market.market_priority || "Medium", owner: market.owner || "", is_focus_market: !!market.is_focus_market, is_union_market: !!market.is_union_market });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const body: any = { ...extra, is_focus_market: extra.is_focus_market ? 1 : 0, is_union_market: extra.is_union_market ? 1 : 0, reason: "Edited via market detail" };
      for (const [k, v] of Object.entries(form)) body[k] = v === "" ? null : v;
      await api.updateMarket(market.id, body);
      toast("Market updated — recommendation recalculated");
      onSaved();
    } catch (e: any) { toast(e.message || "Save failed", "error"); } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${market.market} — ${market.skill_type}`} width={620}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save & recalculate"}</button></>}>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([k, label, type]) => (
          <Field key={k} label={label}>
            <input className="input" type={type === "date" ? "date" : "number"} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </Field>
        ))}
        <Field label="Market priority"><select className="input" value={extra.market_priority} onChange={(e) => setExtra({ ...extra, market_priority: e.target.value })}><option>High</option><option>Medium</option><option>Low</option></select></Field>
        <Field label="Owner"><input className="input" value={extra.owner} onChange={(e) => setExtra({ ...extra, owner: e.target.value })} /></Field>
      </div>
      <div className="mt-3 flex gap-4">
        <label className="flex items-center gap-2 text-[12.5px] text-ink-muted"><input type="checkbox" checked={extra.is_focus_market} onChange={(e) => setExtra({ ...extra, is_focus_market: e.target.checked })} /> Focus market</label>
        <label className="flex items-center gap-2 text-[12.5px] text-ink-muted"><input type="checkbox" checked={extra.is_union_market} onChange={(e) => setExtra({ ...extra, is_union_market: e.target.checked })} /> Union market</label>
      </div>
      <p className="mt-3 text-[11px] text-ink-faint">Changes are audited and the market's recommendation, scores, and alerts recompute immediately.</p>
    </Modal>
  );
}

function CreateHandoffModal({ open, onClose, market, onSaved }: any) {
  const [form, setForm] = useState({
    handoff_type: "Demand / Marketing", owner: "Demand Ops", deadline: "", status: "Not Sent",
    escalation_level: "Level 1", demand_gap: market.forecasted_demand ?? 30, needed_work_volume: 50, notes: "",
  });
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try { await api.createHandoff({ market_id: market.id, ...form }); toast("Handoff created"); onSaved(); }
    catch (e: any) { toast(e.message || "Failed", "error"); } finally { setSaving(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title={`Create handoff · ${market.market}`} width={560}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving}>Create handoff</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><select className="input" value={form.handoff_type} onChange={(e) => setForm({ ...form, handoff_type: e.target.value })}><option>Demand / Marketing</option><option>B2B / Commercial</option><option>Field Ops</option></select></Field>
        <Field label="Owner"><input className="input" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></Field>
        <Field label="Deadline"><input type="date" className="input" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field>
        <Field label="Status"><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{["Not Sent", "Sent", "Accepted", "In Progress", "At Risk", "Resolved", "Missed"].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Demand gap"><input type="number" className="input" value={form.demand_gap} onChange={(e) => setForm({ ...form, demand_gap: Number(e.target.value) })} /></Field>
        <Field label="Needed work volume"><input type="number" className="input" value={form.needed_work_volume} onChange={(e) => setForm({ ...form, needed_work_volume: Number(e.target.value) })} /></Field>
      </div>
      <Field label="Notes" className="mt-3"><textarea className="input min-h-[64px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
    </Modal>
  );
}

function RequestExceptionModal({ open, onClose, market, onSaved }: any) {
  const [form, setForm] = useState({
    requested_by: "", required_support_team: "Demand / Marketing", exception_reason: market.exception_reason || "",
    risk_acknowledged: true, override_status: "Requested", risk_level: market.rec?.risk_level || "High",
  });
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await api.createException({ market_id: market.id, system_recommendation: market.rec?.readiness_status, ...form });
      toast("Leadership exception requested");
      onSaved();
    } catch (e: any) { toast(e.message || "Failed", "error"); } finally { setSaving(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title={`Request leadership exception · ${market.market}`} width={560}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving}>Submit request</button></>}>
      <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
        System recommendation is <b>{market.rec?.readiness_status}</b> (risk {market.rec?.risk_score}). An exception documents that hiring continues despite identified risk.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Requested by"><input className="input" value={form.requested_by} onChange={(e) => setForm({ ...form, requested_by: e.target.value })} placeholder="Name / role" /></Field>
        <Field label="Required support team"><input className="input" value={form.required_support_team} onChange={(e) => setForm({ ...form, required_support_team: e.target.value })} /></Field>
      </div>
      <Field label="Reason / business justification" className="mt-3"><textarea className="input min-h-[72px]" value={form.exception_reason} onChange={(e) => setForm({ ...form, exception_reason: e.target.value })} /></Field>
      <label className="mt-3 flex items-center gap-2 text-[12.5px] text-ink-muted"><input type="checkbox" checked={form.risk_acknowledged} onChange={(e) => setForm({ ...form, risk_acknowledged: e.target.checked })} /> Risk acknowledged by requester</label>
    </Modal>
  );
}

function ResolveAlertModal({ alert, market, onClose, onResolved }: any) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await api.createDecision({
        market_id: market.id, decision_type: "Alert resolved",
        decision_summary: `${alert.risk_type || alert.signal_type} resolved`, decided_by: "current user",
        reason: notes || alert.next_step, outcome: "Resolved",
      });
      toast("Alert resolved & logged");
      onResolved();
    } catch (e: any) { toast(e.message || "Failed", "error"); } finally { setSaving(false); }
  }
  return (
    <Modal open={!!alert} onClose={onClose} title="Resolve alert" width={480}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving}>Resolve with note</button></>}>
      {alert && (
        <>
          <div className="mb-3 rounded-lg border border-line bg-surface-raised/50 p-3">
            <div className="mb-1 flex items-center gap-2"><SeverityPill sev={alert.severity} /><span className="text-[12.5px] font-medium text-ink">{alert.risk_type || alert.signal_type}</span></div>
            <p className="text-[12.5px] text-ink-muted">{alert.explanation}</p>
            <p className="mt-1 text-[11px] text-ink-faint">Suggested: {alert.next_step}</p>
          </div>
          <Field label="Resolution note"><textarea className="input min-h-[72px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What action was taken or decided?" /></Field>
          <p className="mt-2 text-[11px] text-ink-faint">Resolution is recorded in the decision history and audit trail.</p>
        </>
      )}
    </Modal>
  );
}
