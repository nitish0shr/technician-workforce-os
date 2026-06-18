import React, { useState } from "react";
import { ShieldCheck, ShieldAlert, Plus, ArrowRight } from "lucide-react";
import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { PageHeader, StatCard, Owner } from "../components/page";
import { DataTable, Col } from "../components/DataTable";
import { Modal, Field } from "../components/overlays";
import { Loading, ErrorState, Pill, RiskPill, StatusPill } from "../components/primitives";
import { toast } from "../components/toast";
import { exceptionDot } from "../lib/status";
import { fmtDate, num, copyText } from "../lib/format";

const OVERRIDE = ["Requested", "Under Review", "Approved", "Denied", "Withdrawn"];
const OUTCOMES = ["Open", "On track", "Resolved", "Hiring paused", "Escalated"];

export default function LeadershipDecisions() {
  const { data, loading, error, reload } = useAsync<any[]>(() => api.exceptions(), []);
  const { data: markets, reload: reloadMarkets } = useAsync<any[]>(() => api.markets(), []);
  const [edit, setEdit] = useState<any>(null);
  const [creating, setCreating] = useState<any>(null);

  if (loading) return <Loading label="Loading leadership decisions" />;
  if (error || !data) return <ErrorState message={error || "No data"} retry={reload} />;

  const approvedMarketIds = new Set(data.filter((e) => e.override_status === "Approved").map((e) => e.market_id));
  const atRiskNoException = (markets || []).filter((m) => m.rec.readiness_status === "At Risk" && !approvedMarketIds.has(m.id) && !data.some((e) => e.market_id === m.id && e.override_status === "Requested"));
  const approved = data.filter((e) => e.override_status === "Approved");
  const pending = data.filter((e) => ["Requested", "Under Review"].includes(e.override_status));

  function refresh() { reload(); reloadMarkets(); }

  const columns: Col<any>[] = [
    { id: "market", header: "Market", accessor: (e) => e.market, cell: (e) => <div><div className="font-medium text-ink">{num(e.market)}</div><div className="text-[11px] text-ink-faint">{num(e.skill_type)}</div></div> },
    { id: "system_recommendation", header: "System rec", accessor: (e) => e.system_recommendation, cell: (e) => <span className="text-[12px] text-ink-muted">{num(e.system_recommendation)}</span> },
    { id: "risk_level", header: "Risk", accessor: (e) => e.risk_level, cell: (e) => <RiskPill level={e.risk_level || "High"} /> },
    { id: "override_status", header: "Override", accessor: (e) => e.override_status, cell: (e) => <Pill dot={exceptionDot(e.override_status)}>{e.override_status}</Pill> },
    { id: "requested_by", header: "Requested by", accessor: (e) => e.requested_by, cell: (e) => <span className="text-[12px] text-ink-muted">{num(e.requested_by)}</span> },
    { id: "approved_by", header: "Approved by", accessor: (e) => e.approved_by, cell: (e) => <span className="text-[12px] text-ink-muted">{num(e.approved_by)}</span> },
    { id: "review_date", header: "Review", accessor: (e) => e.review_date, cell: (e) => <span className="text-ink-muted">{fmtDate(e.review_date)}</span> },
    { id: "risk_acknowledged", header: "Risk ack.", align: "center", accessor: (e) => e.risk_acknowledged, cell: (e) => e.risk_acknowledged ? <span className="text-emerald-600">✓</span> : <span className="text-ink-faint">—</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Leadership Decisions"
        description="Where hiring continues despite system-identified risk — with a named requester, approver, acknowledged risk, support team, and review date."
        actions={<button className="btn-primary" onClick={() => setCreating({})}><Plus className="h-3.5 w-3.5" /> Request exception</button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active exceptions" value={approved.length} tone="violet" icon={<ShieldCheck className="h-4 w-4" />} hint="Hiring continues with owned risk" />
        <StatCard label="Pending approval" value={pending.length} tone="amber" icon={<ShieldAlert className="h-4 w-4" />} hint="Awaiting leadership sign-off" />
        <StatCard label="At risk, no exception" value={atRiskNoException.length} tone="rose" icon={<ShieldAlert className="h-4 w-4" />} hint="Need an owner before hiring" />
        <StatCard label="Total tracked" value={data.length} tone="sky" icon={<ShieldCheck className="h-4 w-4" />} />
      </div>

      {atRiskNoException.length > 0 && (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="mb-2 flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-rose-600" /><span className="text-[13px] font-semibold text-rose-800">Risk without an owner</span></div>
          <p className="mb-3 text-[12.5px] text-ink-muted">These markets are At Risk and have no leadership exception on file. Hiring should not continue until risk is explicitly owned.</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {atRiskNoException.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                <div className="min-w-0"><div className="truncate text-[13px] font-medium text-ink">{m.market} · {m.skill_type}</div><div className="text-[11px] text-ink-faint">risk {m.rec.risk_score} · {m.rec.risk_drivers?.[0] || "elevated risk"}</div></div>
                <button className="btn-ghost shrink-0 text-[12px]" onClick={() => setCreating(m)}>Request <ArrowRight className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <DataTable
        data={data}
        columns={columns}
        initialSort={[{ id: "override_status", desc: false }]}
        searchPlaceholder="Filter exceptions…"
        onRowClick={(e) => setEdit(e)}
        getRowId={(e) => String(e.id)}
        emptyTitle="No leadership exceptions yet"
      />

      <div className="mt-5 rounded-xl border border-line bg-surface-raised/40 p-4 text-[12.5px] leading-relaxed text-ink-muted">
        <span className="font-semibold text-ink">Positioning for leadership:</span> We are not stopping hiring. We are prioritizing hiring effort, making operational risk visible, and protecting retention before new hires are affected.
        <button className="ml-2 text-brand-soft hover:underline" onClick={() => { copyText("We are not stopping hiring. We are prioritizing hiring effort, making operational risk visible, and protecting retention before new hires are affected."); toast("Positioning copied"); }}>Copy</button>
      </div>

      <ExceptionModal
        open={!!edit || !!creating}
        exception={edit}
        market={creating && creating.id ? creating : null}
        markets={markets || []}
        onClose={() => { setEdit(null); setCreating(null); }}
        onSaved={() => { setEdit(null); setCreating(null); refresh(); }}
      />
    </div>
  );
}

function ExceptionModal({ open, exception, market, markets, onClose, onSaved }: any) {
  const isEdit = !!exception;
  const initial = () => ({
    market_id: exception?.market_id || market?.id || markets[0]?.id || "",
    system_recommendation: exception?.system_recommendation || market?.rec?.readiness_status || "",
    risk_level: exception?.risk_level || market?.rec?.risk_level || "High",
    override_status: exception?.override_status || "Requested",
    requested_by: exception?.requested_by || "",
    approved_by: exception?.approved_by || "",
    approval_date: exception?.approval_date || "",
    exception_reason: exception?.exception_reason || market?.exception_reason || "",
    risk_acknowledged: exception?.risk_acknowledged ? true : false,
    required_support_team: exception?.required_support_team || "Demand / Marketing",
    review_date: exception?.review_date || "",
    outcome: exception?.outcome || "Open",
    notes: exception?.notes || "",
  });
  const [form, setForm] = useState<any>(initial);
  const [busy, setBusy] = useState(false);
  React.useEffect(() => { if (open) setForm(initial()); /* eslint-disable-next-line */ }, [open, exception, market]);

  async function save() {
    setBusy(true);
    try {
      if (isEdit) await api.updateException(exception.id, form);
      else await api.createException(form);
      toast(isEdit ? "Exception updated" : "Exception requested");
      onSaved();
    } catch (e: any) { toast(e.message || "Failed", "error"); } finally { setBusy(false); }
  }

  const selMarket = markets.find((m: any) => m.id === Number(form.market_id));

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Leadership exception · ${exception?.market}` : "Request leadership exception"} width={640}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : isEdit ? "Save decision" : "Submit request"}</button></>}>
      {(selMarket || market) && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[12px]">
          <StatusPill status={(selMarket || market).rec.readiness_status} />
          <RiskPill level={(selMarket || market).rec.risk_level} score={(selMarket || market).rec.risk_score} />
          <span className="text-ink-faint">System says: continue hiring would proceed despite this risk.</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {!isEdit && (
          <Field label="Market" className="col-span-2">
            <select className="input" value={form.market_id} onChange={(e) => setForm({ ...form, market_id: Number(e.target.value) })}>
              {markets.map((m: any) => <option key={m.id} value={m.id}>{m.market} — {m.skill_type} ({m.rec?.readiness_status})</option>)}
            </select>
          </Field>
        )}
        <Field label="System recommendation"><input className="input" value={form.system_recommendation} onChange={(e) => setForm({ ...form, system_recommendation: e.target.value })} /></Field>
        <Field label="Risk level"><select className="input" value={form.risk_level} onChange={(e) => setForm({ ...form, risk_level: e.target.value })}>{["Low", "Medium", "High", "Critical"].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Override status"><select className="input" value={form.override_status} onChange={(e) => setForm({ ...form, override_status: e.target.value })}>{OVERRIDE.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Outcome"><select className="input" value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })}>{OUTCOMES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Requested by"><input className="input" value={form.requested_by} onChange={(e) => setForm({ ...form, requested_by: e.target.value })} /></Field>
        <Field label="Approved by"><input className="input" value={form.approved_by} onChange={(e) => setForm({ ...form, approved_by: e.target.value })} placeholder="VP / Director" /></Field>
        <Field label="Approval date"><input type="date" className="input" value={form.approval_date || ""} onChange={(e) => setForm({ ...form, approval_date: e.target.value })} /></Field>
        <Field label="Review date"><input type="date" className="input" value={form.review_date || ""} onChange={(e) => setForm({ ...form, review_date: e.target.value })} /></Field>
        <Field label="Required support team" className="col-span-2"><input className="input" value={form.required_support_team} onChange={(e) => setForm({ ...form, required_support_team: e.target.value })} /></Field>
      </div>
      <Field label="Reason / business justification" className="mt-3"><textarea className="input min-h-[64px]" value={form.exception_reason} onChange={(e) => setForm({ ...form, exception_reason: e.target.value })} /></Field>
      <Field label="Notes" className="mt-3"><textarea className="input min-h-[52px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      <label className="mt-3 flex items-center gap-2 text-[12.5px] text-ink-muted"><input type="checkbox" checked={form.risk_acknowledged} onChange={(e) => setForm({ ...form, risk_acknowledged: e.target.checked })} /> Risk explicitly acknowledged by approver</label>
    </Modal>
  );
}
