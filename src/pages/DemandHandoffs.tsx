import React, { useState } from "react";
import { Megaphone, Plus, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { PageHeader, StatCard, Owner } from "../components/page";
import { DataTable, Col } from "../components/DataTable";
import { Modal, Field } from "../components/overlays";
import { Loading, ErrorState, Pill } from "../components/primitives";
import { toast } from "../components/toast";
import { handoffDot } from "../lib/status";
import { fmtDate, num } from "../lib/format";

const STATUSES = ["Not Sent", "Sent", "Accepted", "In Progress", "At Risk", "Resolved", "Missed"];
const TYPES = ["Demand / Marketing", "B2B / Commercial", "Field Ops"];
const ESCALATION = ["Level 1", "Level 2", "Level 3"];

export default function DemandHandoffs() {
  const { data, loading, error, reload } = useAsync<any[]>(() => api.handoffs(), []);
  const { data: markets } = useAsync<any[]>(() => api.markets(), []);
  const [edit, setEdit] = useState<any>(null);
  const [creating, setCreating] = useState(false);

  if (loading) return <Loading label="Loading demand handoffs" />;
  if (error || !data) return <ErrorState message={error || "No data"} retry={reload} />;

  const open = data.filter((h) => !["Resolved", "Missed"].includes(h.status));
  const atRisk = data.filter((h) => h.status === "At Risk");
  const resolved = data.filter((h) => h.status === "Resolved");
  const missed = data.filter((h) => h.status === "Missed");

  const columns: Col<any>[] = [
    { id: "market", header: "Market", accessor: (h) => h.market, cell: (h) => <div><div className="font-medium text-ink">{num(h.market)}</div><div className="text-[11px] text-ink-faint">{num(h.skill_type)} · {h.handoff_type}</div></div> },
    { id: "status", header: "Status", accessor: (h) => h.status, cell: (h) => <Pill dot={handoffDot(h.status)}>{h.status}</Pill> },
    { id: "escalation_level", header: "Escalation", accessor: (h) => h.escalation_level, cell: (h) => <span className="chip">{h.escalation_level}</span> },
    { id: "demand_gap", header: "Demand gap", align: "right", accessor: (h) => h.demand_gap ?? 0, cell: (h) => <span className="tabular-nums">{num(h.demand_gap)}</span> },
    { id: "needed_work_volume", header: "Needed work", align: "right", accessor: (h) => h.needed_work_volume ?? 0, cell: (h) => <span className="tabular-nums text-ink-muted">{num(h.needed_work_volume)}</span> },
    { id: "pending_starts", header: "Starts", align: "right", accessor: (h) => h.pending_starts ?? 0, cell: (h) => <span className="tabular-nums text-ink-muted">{num(h.pending_starts)}</span> },
    { id: "deadline", header: "Deadline", accessor: (h) => h.deadline, cell: (h) => <span className="text-ink-muted">{fmtDate(h.deadline)}</span> },
    { id: "owner", header: "Owner", accessor: (h) => h.owner, cell: (h) => <Owner name={h.owner} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Demand Handoffs"
        description="Track markets that need demand, marketing, or B2B support before more starts land. Create, escalate, and close handoffs with a clear owner."
        actions={<button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> New handoff</button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open" value={open.length} tone="sky" icon={<Megaphone className="h-4 w-4" />} hint="Active handoffs in flight" />
        <StatCard label="At risk" value={atRisk.length} tone="rose" icon={<AlertTriangle className="h-4 w-4" />} hint="Slipping against deadline" />
        <StatCard label="Resolved" value={resolved.length} tone="emerald" icon={<CheckCircle2 className="h-4 w-4" />} hint="Demand support delivered" />
        <StatCard label="Missed" value={missed.length} tone="amber" icon={<AlertTriangle className="h-4 w-4" />} hint="Closed without resolution" />
      </div>

      <DataTable
        data={data}
        columns={columns}
        initialSort={[{ id: "status", desc: false }]}
        searchPlaceholder="Filter handoffs…"
        onRowClick={(h) => setEdit(h)}
        getRowId={(h) => String(h.id)}
        emptyTitle="No handoffs yet"
      />

      <HandoffModal
        open={creating || !!edit}
        handoff={edit}
        markets={markets || []}
        onClose={() => { setCreating(false); setEdit(null); }}
        onSaved={() => { setCreating(false); setEdit(null); reload(); }}
      />
    </div>
  );
}

function HandoffModal({ open, handoff, markets, onClose, onSaved }: any) {
  const isEdit = !!handoff;
  const [form, setForm] = useState<any>(() => ({
    market_id: handoff?.market_id || markets[0]?.id || "",
    handoff_type: handoff?.handoff_type || "Demand / Marketing",
    owner: handoff?.owner || "Demand Ops",
    deadline: handoff?.deadline || "",
    status: handoff?.status || "Not Sent",
    escalation_level: handoff?.escalation_level || "Level 1",
    demand_gap: handoff?.demand_gap ?? 30,
    needed_work_volume: handoff?.needed_work_volume ?? 50,
    notes: handoff?.notes || "",
  }));
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (open) setForm({
      market_id: handoff?.market_id || markets[0]?.id || "",
      handoff_type: handoff?.handoff_type || "Demand / Marketing",
      owner: handoff?.owner || "Demand Ops",
      deadline: handoff?.deadline || "",
      status: handoff?.status || "Not Sent",
      escalation_level: handoff?.escalation_level || "Level 1",
      demand_gap: handoff?.demand_gap ?? 30,
      needed_work_volume: handoff?.needed_work_volume ?? 50,
      notes: handoff?.notes || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, handoff]);

  async function save(closeIt?: boolean) {
    setBusy(true);
    try {
      const body = { ...form, status: closeIt ? "Resolved" : form.status };
      if (isEdit) await api.updateHandoff(handoff.id, body);
      else await api.createHandoff(body);
      toast(isEdit ? (closeIt ? "Handoff resolved" : "Handoff updated") : "Handoff created");
      onSaved();
    } catch (e: any) { toast(e.message || "Failed", "error"); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Edit handoff · ${handoff?.market}` : "New demand handoff"} width={600}
      footer={
        <>
          {isEdit && form.status !== "Resolved" && <button className="btn mr-auto" onClick={() => save(true)} disabled={busy}><CheckCircle2 className="h-3.5 w-3.5" /> Close as resolved</button>}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => save(false)} disabled={busy}>{busy ? "Saving…" : isEdit ? "Save changes" : "Create handoff"}</button>
        </>
      }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Market" className="col-span-2">
          <select className="input" value={form.market_id} disabled={isEdit} onChange={(e) => setForm({ ...form, market_id: Number(e.target.value) })}>
            {markets.map((m: any) => <option key={m.id} value={m.id}>{m.market} — {m.skill_type} ({m.rec?.readiness_status})</option>)}
          </select>
        </Field>
        <Field label="Type"><select className="input" value={form.handoff_type} onChange={(e) => setForm({ ...form, handoff_type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Owner"><input className="input" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></Field>
        <Field label="Status"><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Escalation"><select className="input" value={form.escalation_level} onChange={(e) => setForm({ ...form, escalation_level: e.target.value })}>{ESCALATION.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Deadline"><input type="date" className="input" value={form.deadline || ""} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field>
        <Field label="Demand gap"><input type="number" className="input" value={form.demand_gap} onChange={(e) => setForm({ ...form, demand_gap: Number(e.target.value) })} /></Field>
        <Field label="Needed work volume" className="col-span-2"><input type="number" className="input" value={form.needed_work_volume} onChange={(e) => setForm({ ...form, needed_work_volume: Number(e.target.value) })} /></Field>
      </div>
      <Field label="Notes" className="mt-3"><textarea className="input min-h-[72px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
    </Modal>
  );
}
