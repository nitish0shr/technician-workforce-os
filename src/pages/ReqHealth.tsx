import React from "react";
import { Filter, Ban, Stethoscope, CheckCircle2, Users, Workflow, UserCog } from "lucide-react";
import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { PageHeader, SectionCard, StatCard } from "../components/page";
import { Loading, ErrorState, Pill, StackBar } from "../components/primitives";
import { classNames as cx } from "../lib/format";

const DXTONE: Record<string, string> = {
  sky: "bg-sky-500", violet: "bg-violet-500", amber: "bg-amber-500",
  orange: "bg-orange-500", rose: "bg-rose-500", emerald: "bg-emerald-500",
};
// Fixed order + tone for the diagnosis distribution bar.
const DIAGS: [string, string][] = [
  ["Low applicant volume", "bg-sky-500"],
  ["Low interview→offer", "bg-violet-500"],
  ["Low offer acceptance", "bg-amber-500"],
  ["High pre-start fallout", "bg-orange-500"],
  ["Recruiter capacity", "bg-rose-500"],
  ["Healthy pipeline", "bg-emerald-500"],
];
const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);

export default function ReqHealth() {
  const { data, loading, error, reload } = useAsync<any>(() => api.reqHealth(), []);
  if (loading) return <Loading label="Diagnosing requisition health" />;
  if (error || !data) return <ErrorState message={error || "No data"} retry={reload} />;

  const s = data.summary;
  const rows: any[] = data.rows || [];
  const dxCount: Record<string, number> = Object.fromEntries((data.byDiagnosis || []).map((d: any) => [d.key, d.count]));
  const overloaded = new Set<string>(data.overloaded || []);
  const sourceMax = Math.max(1, ...(data.sources || []).map((x: any) => x.count));

  return (
    <div>
      <PageHeader
        eyebrow="Execution"
        title="Requisition Health"
        description="Is this a real workforce need, or a recruiting-process problem? When an open req isn't filling, this names the failure mode — thin pipeline, weak conversion, declined offers, fallout, or recruiter overload — and prescribes the fix instead of opening another req."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Don't open more reqs" value={s.dont_open_more} tone="rose" icon={<Ban className="h-4 w-4" />} hint="fix the process, not the seat count" />
        <StatCard label="Process problems" value={s.process_problems} tone="amber" icon={<Stethoscope className="h-4 w-4" />} hint="not a true capacity gap" />
        <StatCard label="Healthy pipelines" value={s.healthy} tone="emerald" icon={<CheckCircle2 className="h-4 w-4" />} hint="converting — safe to hire" />
        <StatCard label="Candidates / seat" value={s.avg_per_seat} tone="sky" icon={<Users className="h-4 w-4" />} hint={`${s.candidates} in funnel`} />
      </div>

      <div className="mb-5 rounded-xl border border-line bg-surface px-4 py-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="section-label">Diagnosis mix</span>
          <span className="text-[11px] text-ink-faint">{s.markets} markets</span>
        </div>
        <StackBar segments={DIAGS.map(([label, cls]) => ({ label, value: dxCount[label] || 0, cls }))} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: per-market diagnosis + intervention */}
        <div className="lg:col-span-2">
          <SectionCard title="By market" icon={<Filter className="h-4 w-4" />} pad={false}
            action={<span className="text-[11px] text-ink-faint">"Don't open more" first</span>}>
            <div className="divide-y divide-line-soft">
              {rows.map((r) => (
                <div key={r.id} className="px-4 py-3 row-hover">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-ink">{r.market} <span className="font-normal text-ink-faint">· {r.skill}</span></span>
                    <Pill dot={DXTONE[r.diagnosis_tone] || "bg-zinc-400"}>{r.diagnosis}</Pill>
                    {r.dont_open_more && <span className={cx("chip", "border-red-200 bg-red-50 text-red-700")}>Don't open more reqs</span>}
                    {r.low_sample && <span className="chip">Low sample</span>}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{r.intervention}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] tabular-nums text-ink-faint">
                    <span><span className="text-ink-muted">{r.total}</span> candidates</span>
                    <span><span className="text-ink-muted">{r.per_seat}</span>/seat · {r.open_reqs} reqs</span>
                    <span title={`${r.offered}/${r.interviewed} reached offer`}>I→O <span className="text-ink-muted">{pct(r.i2o)}</span></span>
                    <span title={`${r.accepted}/${r.offered} accepted`}>Accept <span className="text-ink-muted">{pct(r.oar)}</span></span>
                    <span>Fallout <span className="text-ink-muted">{pct(r.fallout_rate)}</span></span>
                    <span><span className="text-ink-muted">{r.started}</span> started</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Right: recruiter load + source attribution */}
        <div className="space-y-4">
          <SectionCard title="Recruiter load" icon={<UserCog className="h-4 w-4" />}>
            <div className="space-y-1.5 text-[12.5px]">
              {(data.recruiterLoad || []).map((r: any) => (
                <div key={r.recruiter} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-ink-muted">
                    <span className={cx("h-1.5 w-1.5 rounded-full", overloaded.has(r.recruiter) ? "bg-rose-500" : "bg-zinc-300")} />
                    {r.recruiter}
                  </span>
                  <span className={cx("tabular-nums", overloaded.has(r.recruiter) ? "font-semibold text-rose-600" : "text-ink")}>{r.count}</span>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-ink-faint">Active candidates carried. Red = over capacity.</p>
            </div>
          </SectionCard>

          <SectionCard title="Source attribution" icon={<Workflow className="h-4 w-4" />}>
            <div className="space-y-2">
              {(data.sources || []).map((src: any) => {
                const starts = (data.startsBySource || []).find((x: any) => x.key === src.key)?.count || 0;
                return (
                  <div key={src.key} className="flex items-center gap-3">
                    <span className="w-24 truncate text-[12px] text-ink-muted">{src.key}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-line-soft">
                      <div className="h-full rounded-full bg-brand/55" style={{ width: `${(src.count / sourceMax) * 100}%` }} />
                    </div>
                    <span className="w-14 text-right text-[11px] tabular-nums text-ink-faint">{starts} start{starts === 1 ? "" : "s"}</span>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
