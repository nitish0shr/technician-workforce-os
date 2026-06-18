import React, { useState } from "react";
import { CalendarClock, ArrowRight, MapPin } from "lucide-react";
import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { PageHeader, StatCard } from "../components/page";
import { Loading, ErrorState, GoLivePill, DemandPill, TrainingPill, Pill } from "../components/primitives";
import { MarketDetail } from "../components/MarketDetail";
import { fmtDate, num, classNames as cx } from "../lib/format";

const TABS = [
  { key: "next7", label: "Next 7 days" },
  { key: "next14", label: "Next 14 days" },
  { key: "next30", label: "Next 30 days" },
];

export default function StartReadiness() {
  const { data, loading, error, reload } = useAsync<any>(() => api.startReadiness(), []);
  const [tab, setTab] = useState("next7");
  const [sel, setSel] = useState<number | null>(null);

  if (loading) return <Loading label="Assessing upcoming starts" />;
  if (error || !data) return <ErrorState message={error || "No data"} retry={reload} />;

  const rows: any[] = data[tab] || [];
  const all: any[] = data.next30 || [];
  const count = (s: string) => all.filter((r) => r.go_live_status === s).length;

  return (
    <div>
      <PageHeader
        title="Start Readiness"
        description="Go-live risk for upcoming technician starts. Flags starts that land into low work, thin mentor capacity, or missing training support."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ready" value={count("Ready")} tone="emerald" icon={<CalendarClock className="h-4 w-4" />} hint="On track to go live" />
        <StatCard label="Watch" value={count("Watch")} tone="amber" icon={<CalendarClock className="h-4 w-4" />} hint="Confirm support this week" />
        <StatCard label="Blocked" value={count("Blocked")} tone="rose" icon={<CalendarClock className="h-4 w-4" />} hint="Low work or no mentor/training" />
        <StatCard label="Unknown" value={count("Unknown")} tone="sky" icon={<CalendarClock className="h-4 w-4" />} hint="Missing capacity data" />
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-line bg-surface p-0.5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cx("rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors", tab === t.key ? "bg-surface-hover text-ink" : "text-ink-muted hover:text-ink")}>
            {t.label} <span className="ml-1 text-ink-faint">{(data[t.key] || []).length}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface/30 px-4 py-12 text-center text-[13px] text-ink-faint">No pending starts in this window.</div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => <StartCard key={r.id} r={r} onOpen={() => setSel(r.id)} />)}
        </div>
      )}

      <MarketDetail marketId={sel} onClose={() => setSel(null)} onChanged={reload} />
    </div>
  );
}

function StartCard({ r, onOpen }: { r: any; onOpen: () => void }) {
  const days = r.days_until_start;
  const dayTone = days <= 3 ? "text-rose-600" : days <= 7 ? "text-amber-700" : "text-ink-muted";
  return (
    <button onClick={onOpen} className="card group block w-full p-4 text-left transition-colors hover:border-line hover:bg-surface-hover/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-ink">{r.market}</span>
            <span className="chip">{r.skill}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-faint"><MapPin className="h-3 w-3" /> {r.planning_area}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] text-ink-faint">Next start</div>
            <div className="text-[12.5px] font-medium text-ink">{fmtDate(r.next_start_date)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-ink-faint">In</div>
            <div className={cx("text-[12.5px] font-semibold tabular-nums", dayTone)}>{days != null ? `${days}d` : "—"}</div>
          </div>
          <GoLivePill status={r.go_live_status} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Pill className="text-ink-muted border-line bg-surface-raised">{num(r.pending_starts)} pending starts</Pill>
        <DemandPill status={r.demand_status} />
        <TrainingPill status={r.training_status} />
        <span className="chip">Work {num(r.work_volume)}</span>
        <span className="chip">Forward {num(r.forward_capacity)}</span>
        <span className="chip">Mentor {num(r.mentor_capacity)}</span>
        <span className="chip">Training {num(r.training_capacity)}</span>
        <span className="chip">Skill match {r.skill_match ?? "—"}%</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-2.5">
        <p className="text-[12.5px] text-ink-muted">{r.go_live_explanation}</p>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink"><ArrowRight className="h-3.5 w-3.5 text-brand-soft" /> {r.action_needed}</span>
        <span className="text-[11px] text-ink-faint">Owner: {num(r.owner)}</span>
      </div>
    </button>
  );
}
