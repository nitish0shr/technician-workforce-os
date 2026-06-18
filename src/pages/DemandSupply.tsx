import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Scale, ArrowUpRight, ClipboardCopy, Boxes } from "lucide-react";
import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { PageHeader, SectionCard } from "../components/page";
import { Loading, ErrorState, DemandPill, Pill } from "../components/primitives";
import { MarketDetail } from "../components/MarketDetail";
import { toast } from "../components/toast";
import { copyText, classNames as cx } from "../lib/format";
import { demandDot } from "../lib/status";
import type { DemandSupplyReport, DemandSupplyRow } from "../lib/types";

const STATE_DOT: Record<string, string> = {
  Understaffed: "bg-blue-500",
  "Capacity-blocked": "bg-amber-500",
  "Demand-soft": "bg-zinc-400",
  "Supply-met": "bg-emerald-500",
  Unknown: "bg-zinc-400",
};

function GapBar({ gap }: { gap: number | null }) {
  if (gap == null) return <span className="text-ink-faint">—</span>;
  const mag = Math.min(50, Math.abs(gap) * 7);
  const pos = gap > 0;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-16 rounded-full bg-line-soft">
        <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
        <span
          className={cx("absolute inset-y-0 rounded-full", pos ? "bg-brand/70" : "bg-amber-400")}
          style={pos ? { left: "50%", width: `${mag}%` } : { right: "50%", width: `${mag}%` }}
        />
      </div>
      <span className={cx("w-8 text-right text-[12.5px] font-semibold tabular-nums", pos ? "text-ink" : "text-amber-700")}>
        {gap > 0 ? `+${gap}` : gap}
      </span>
    </div>
  );
}

const StatePill = ({ state }: { state: string }) => <Pill dot={STATE_DOT[state] || "bg-zinc-400"}>{state}</Pill>;

export default function DemandSupply() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync<DemandSupplyReport>(() => api.demandSupply(), []);
  const [sel, setSel] = useState<number | null>(null);

  if (loading) return <Loading label="Balancing demand against supply" />;
  if (error || !data) return <ErrorState message={error || "No data"} retry={reload} />;

  const t = data.totals;
  const understaffedRows = data.understaffed;
  const demandLed = t.understaffed + t.capacity_blocked;
  const supplyLed = t.supply_met + t.demand_soft;
  const demandMax = Math.max(1, ...data.byDemand.map((d) => d.count));

  function copySummary() {
    const lines = [
      `TECHNICIAN WORKFORCE — DEMAND vs SUPPLY (${new Date().toISOString().slice(0, 10)})`,
      "",
      `Demand outpaces supply in ${demandLed} market(s): ${t.understaffed} ready to add supply, ${t.capacity_blocked} blocked on field capacity.`,
      `Supply meets demand in ${supplyLed} market(s): ${t.supply_met} at or above target, ${t.demand_soft} where demand is too soft to justify adding supply.`,
      "",
      `Most understaffed: ${understaffedRows.slice(0, 5).map((r) => `${r.market} ${r.skill} (gap ${r.gap})`).join(", ")}.`,
      "",
      `We plan markets, not people — this balances where work exists against the technicians available to do it.`,
    ];
    copyText(lines.join("\n"));
    toast("Demand/supply summary copied");
  }

  return (
    <div>
      <PageHeader
        title="Demand & Supply"
        description="Where demand outpaces the supply of technicians, and where supply already meets demand — the balance behind every hiring call."
        actions={
          <button className="btn" onClick={copySummary}>
            <ClipboardCopy className="h-3.5 w-3.5" /> Copy summary
          </button>
        }
      />

      {/* Hero: the two sides of the balance */}
      <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="card-raised relative overflow-hidden p-5">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand-soft to-brand-dim" />
          <div className="flex items-start gap-3 pl-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-brand"><TrendingUp className="h-4 w-4" /></div>
            <div className="min-w-0">
              <div className="section-label">Demand outpacing supply</div>
              <div className="mt-1 text-[30px] font-bold leading-none tabular-nums tracking-[-0.02em] text-ink">{demandLed}</div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
                <span className="font-medium text-ink">{t.understaffed}</span> ready to add supply · <span className="font-medium text-ink">{t.capacity_blocked}</span> blocked on field capacity.
              </p>
            </div>
          </div>
        </div>

        <div className="card-raised relative overflow-hidden p-5">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-400 to-emerald-600" />
          <div className="flex items-start gap-3 pl-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><Scale className="h-4 w-4" /></div>
            <div className="min-w-0">
              <div className="section-label">Supply meets demand</div>
              <div className="mt-1 text-[30px] font-bold leading-none tabular-nums tracking-[-0.02em] text-ink">{supplyLed}</div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
                <span className="font-medium text-ink">{t.supply_met}</span> at or above target · <span className="font-medium text-ink">{t.demand_soft}</span> where demand is too soft to add supply.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: where demand outpaces supply */}
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Where demand outpaces supply" icon={<TrendingUp className="h-4 w-4" />} pad={false}
            action={<button className="btn-ghost text-[12px]" onClick={() => navigate("/market-readiness")}>Open markets <ArrowUpRight className="h-3.5 w-3.5" /></button>}>
            {data.understaffed.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12.5px] text-ink-faint">No markets where demand currently outpaces supply.</div>
            ) : (
              <div className="divide-y divide-line-soft">
                {data.understaffed.map((r: DemandSupplyRow) => (
                  <button key={r.id} onClick={() => setSel(r.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left row-hover focusable">
                    <div className="w-24 shrink-0"><GapBar gap={r.gap} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-ink">{r.market} <span className="font-normal text-ink-faint">· {r.skill}</span></div>
                      <div className="truncate text-[11px] text-ink-faint">{r.recommended_action}</div>
                    </div>
                    <div className="hidden md:block"><DemandPill status={r.demand_status} /></div>
                    <StatePill state={r.state} />
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Supply meets demand" icon={<Scale className="h-4 w-4" />} pad={false}>
            {data.supplyLed.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12.5px] text-ink-faint">No markets where supply currently meets demand.</div>
            ) : (
              <div className="divide-y divide-line-soft">
                {data.supplyLed.map((r: DemandSupplyRow) => (
                  <button key={r.id} onClick={() => setSel(r.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left row-hover focusable">
                    <div className="w-24 shrink-0"><GapBar gap={r.gap} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-ink">{r.market} <span className="font-normal text-ink-faint">· {r.skill}</span></div>
                      <div className="truncate text-[11px] text-ink-faint">{r.recommended_action}</div>
                    </div>
                    <div className="hidden md:block"><DemandPill status={r.demand_status} /></div>
                    <StatePill state={r.state} />
                  </button>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right: demand mix + state breakdown */}
        <div className="space-y-4">
          <SectionCard title="Demand mix" icon={<Boxes className="h-4 w-4" />}>
            <div className="space-y-2.5">
              {data.byDemand.filter((d) => d.count > 0).map((d) => (
                <div key={d.level} className="flex items-center gap-3">
                  <span className="inline-flex w-16 items-center gap-1.5 text-[12px] text-ink-muted">
                    <span className={cx("h-[7px] w-[7px] rounded-full", demandDot(d.level))} /> {d.level}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-line-soft">
                    <div className={cx("h-full rounded-full", demandDot(d.level), "opacity-80")} style={{ width: `${(d.count / demandMax) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-[12.5px] font-semibold tabular-nums text-ink">{d.count}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="By balance state" icon={<Scale className="h-4 w-4" />}>
            <div className="space-y-1.5 text-[12.5px]">
              {Object.entries(data.byState).filter(([, v]) => v > 0).map(([state, count]) => (
                <div key={state} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-ink-muted">
                    <span className={cx("h-[7px] w-[7px] rounded-full", STATE_DOT[state] || "bg-zinc-400")} /> {state}
                  </span>
                  <span className="tabular-nums text-ink">{count}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
              Gap shows supply shortfall — positive means demand needs more technicians; negative means supply already exceeds demand.
            </p>
          </SectionCard>
        </div>
      </div>

      <MarketDetail marketId={sel} onClose={() => setSel(null)} onChanged={reload} />
    </div>
  );
}
