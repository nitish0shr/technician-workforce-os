import React from "react";
import { Waves, ShieldCheck, Clock, Repeat, Layers } from "lucide-react";
import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { PageHeader, SectionCard, StatCard } from "../components/page";
import { Loading, ErrorState, Pill, Sparkline, StackBar } from "../components/primitives";
import { classNames as cx } from "../lib/format";

// The action ladder, most-hiring → least-hiring, with a tone per rung.
const LADDER: [string, string][] = [
  ["Keep Open - Priority", "bg-emerald-500"],
  ["Keep Open - Balanced", "bg-sky-500"],
  ["Pipeline Only", "bg-amber-500"],
  ["Pause Sourcing", "bg-orange-500"],
  ["Review for Closure", "bg-red-500"],
];
const TONE: Record<string, string> = Object.fromEntries(LADDER);

function StateBadge({ r }: { r: any }) {
  if (r.state === "Pending")
    return <Pill dot="bg-amber-500">Pending {r.pending?.count}/{r.pending?.need}</Pill>;
  if (r.state === "Cooldown")
    return <Pill dot="bg-blue-500">Cooldown{r.cooldown_until ? ` · until ${r.cooldown_until.slice(5)}` : ""}</Pill>;
  return <Pill dot="bg-zinc-400">Stable</Pill>;
}

export default function Stability() {
  const { data, loading, error, reload } = useAsync<any>(() => api.stability(), []);
  if (loading) return <Loading label="Stabilizing recommendations" />;
  if (error || !data) return <ErrorState message={error || "No data"} retry={reload} />;

  const s = data.summary;
  const rows: any[] = data.rows || [];

  return (
    <div>
      <PageHeader
        eyebrow="Governance"
        title="Recommendation Stability"
        description="The anti-flapping layer. The legacy tool would recommend opening reqs one week and closing them the next. This holds a stable action through persistence, hysteresis, cooldowns, and a one-rung-at-a-time action ladder — and shows exactly what it absorbed."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Stable" value={s.stable} tone="emerald" icon={<ShieldCheck className="h-4 w-4" />} hint={`${s.markets} markets`} />
        <StatCard label="Pending confirmation" value={s.pending} tone="amber" icon={<Layers className="h-4 w-4" />} hint="awaiting persistence" />
        <StatCard label="In cooldown" value={s.cooldown} tone="sky" icon={<Clock className="h-4 w-4" />} hint="reversal held 14d" />
        <StatCard label="Swings avoided" value={s.reversals_avoided} tone="violet" icon={<Repeat className="h-4 w-4" />} hint={`${s.stability_improvement}% fewer than naive`} />
      </div>

      <div className="mb-5 rounded-xl border border-line bg-surface px-4 py-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="section-label">Committed action ladder</span>
          <span className="text-[11px] text-ink-faint">naive engine flipped {s.raw_reversals}× · stable engine {s.committed_reversals}×</span>
        </div>
        <StackBar segments={LADDER.map(([label, cls]) => ({ label, value: data.byAction[label] || 0, cls }))} />
      </div>

      <SectionCard title="By market" icon={<Waves className="h-4 w-4" />} pad={false}
        action={<span className="text-[11px] text-ink-faint">Pending & cooldown first · sparkline = 6-week readiness</span>}>
        <div className="divide-y divide-line-soft">
          {rows.map((r) => {
            const flapped = r.raw_action !== r.committed_action;
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 row-hover">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">{r.market} <span className="font-normal text-ink-faint">· {r.skill}</span></div>
                  <div className="truncate text-[11px] text-ink-faint">{r.planning_area}</div>
                </div>
                <Sparkline data={r.series} width={84} height={26} className="hidden shrink-0 sm:block" />
                <div className="hidden w-44 shrink-0 md:block">
                  {flapped ? (
                    <div className="text-[11px] text-ink-faint">naive: <span className="text-orange-600">{r.raw_action}</span></div>
                  ) : null}
                  {r.why_changed ? <div className="truncate text-[11px] text-ink-faint" title={r.why_changed}>{r.why_changed}</div> : null}
                </div>
                <div className="w-40 shrink-0 text-right">
                  <Pill dot={TONE[r.committed_action] || "bg-zinc-400"}>{r.committed_action}</Pill>
                </div>
                <div className="w-36 shrink-0 text-right"><StateBadge r={r} /></div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
