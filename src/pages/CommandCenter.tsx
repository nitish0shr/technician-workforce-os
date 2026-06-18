import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Rocket, ShieldAlert, CalendarClock, GitPullRequestArrow, Sparkles,
  ClipboardCopy, ArrowUpRight, TrendingUp, History, ScrollText, BarChart3,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { PageHeader, SectionCard, StatCard, Owner } from "../components/page";
import { StatusPill, RiskPill, ModePill, ScoreBar, Loading, ErrorState, GoLivePill } from "../components/primitives";
import { Timeline } from "../components/Timeline";
import { MarketDetail } from "../components/MarketDetail";
import { toast } from "../components/toast";
import { copyText, fmtDate, relTime, num, classNames as cx } from "../lib/format";

const RISK_COLOR: Record<string, string> = { Low: "#10b981", Medium: "#f59e0b", High: "#ef4444", Critical: "#b91c1c" };

export default function CommandCenter() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync<any>(() => api.summary(), []);
  const [sel, setSel] = useState<number | null>(null);

  if (loading) return <Loading label="Reading today's workforce signal" />;
  if (error || !data) return <ErrorState message={error || "No data"} retry={reload} />;

  const c = data.counts;
  const riskPie = (data.riskDistribution || []).filter((d: any) => d.count > 0).map((d: any) => ({ ...d, color: RISK_COLOR[d.level] }));
  const actionMax = Math.max(1, ...(data.actionDistribution || []).map((d: any) => d.count));

  return (
    <div>
      <PageHeader
        title="Command Center"
        description="Your daily technician workforce cockpit — where to push, where risk is building, and what needs a decision today."
        actions={
          <button className="btn" onClick={() => { copyText(data.memo); toast("Weekly memo copied"); }}>
            <ClipboardCopy className="h-3.5 w-3.5" /> Copy weekly memo
          </button>
        }
      />

      {/* Today's Workforce Signal */}
      <div className="card-raised relative mb-4 overflow-hidden p-5">
        <div className="absolute inset-y-0 left-0 w-1 bg-brand" />
        <div className="flex items-start gap-3 pl-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand/30 bg-brand/10">
            <Sparkles className="h-5 w-5 text-brand-soft" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="section-label">Today's workforce signal</span>
              <span className="text-[11px] text-ink-faint">· generated {relTime(data.generated_at)}</span>
            </div>
            <p className="text-[16px] font-medium leading-relaxed text-ink">{data.signal}</p>
          </div>
        </div>
      </div>

      {/* Primary operational cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Push now" value={c.pushNow} tone="emerald" icon={<Rocket className="h-4 w-4" />} hint="Ready to hire — source aggressively" onClick={() => navigate("/market-readiness")} />
        <StatCard label="At risk" value={c.atRisk} tone="rose" icon={<ShieldAlert className="h-4 w-4" />} hint="System-identified risk — needs an owner" onClick={() => navigate("/leadership-decisions")} />
        <StatCard label="Starts in next 7 days" value={c.startsNext7} tone="amber" icon={<CalendarClock className="h-4 w-4" />} hint="Check go-live readiness" onClick={() => navigate("/start-readiness")} />
        <StatCard label="Needs decision" value={c.needsDecision} tone="sky" icon={<GitPullRequestArrow className="h-4 w-4" />} hint="Open items in the decision queue" onClick={() => document.getElementById("decision-queue")?.scrollIntoView({ behavior: "smooth" })} />
      </div>

      {/* Distributions — real status & risk mix across the portfolio */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Recommended action distribution" icon={<BarChart3 className="h-4 w-4" />} className="lg:col-span-2">
          <div className="space-y-2">
            {(data.actionDistribution || []).map((d: any) => (
              <button key={d.status} onClick={() => navigate("/market-readiness")} className="flex w-full items-center gap-3 rounded text-left focusable">
                <span className="w-32 shrink-0 truncate text-[12px] text-ink-muted">{d.status}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-line-soft">
                  <div className="h-full rounded-full bg-brand/55 transition-all" style={{ width: `${(d.count / actionMax) * 100}%` }} />
                </div>
                <span className="w-7 text-right text-[13px] font-semibold tabular-nums text-ink">{d.count}</span>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Risk level distribution" icon={<ShieldAlert className="h-4 w-4" />}>
          {riskPie.length === 0 ? (
            <div className="py-8 text-center text-[12.5px] text-ink-faint">No elevated risk.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={148}>
                <PieChart>
                  <Pie data={riskPie} dataKey="count" nameKey="level" cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={2} stroke="none">
                    {riskPie.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e4e7ec", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 12px -2px rgba(16,24,40,0.12)", color: "#1a1f29" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
                {riskPie.map((d: any) => (
                  <span key={d.level} className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                    <span className="h-2 w-2 rounded-full" style={{ background: d.color }} /> {d.level} <span className="tabular-nums text-ink">{d.count}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: priority + risk */}
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Top priority markets" icon={<TrendingUp className="h-4 w-4" />} pad={false}
            action={<button className="btn-ghost text-[12px]" onClick={() => navigate("/market-readiness")}>Open Market Readiness <ArrowUpRight className="h-3.5 w-3.5" /></button>}>
            <div className="divide-y divide-line-soft">
              {data.topPriority.map((m: any) => (
                <button key={m.id} onClick={() => setSel(m.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left row-hover">
                  <div className="w-7 text-center text-[12px] font-semibold tabular-nums text-ink-faint">{m.priority_score}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-ink">{m.market} <span className="font-normal text-ink-faint">· {m.skill}</span></div>
                    <div className="truncate text-[11px] text-ink-faint">{m.planning_area}</div>
                  </div>
                  <div className="hidden w-28 sm:block"><ScoreBar value={m.priority_score} tone="violet" /></div>
                  <div className="w-16 text-center text-[12px] tabular-nums text-ink-muted">gap {num(m.adjusted_staffing_gap)}</div>
                  <StatusPill status={m.readiness_status} />
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Risk queue" icon={<ShieldAlert className="h-4 w-4" />} pad={false}>
            <div className="divide-y divide-line-soft">
              {data.riskQueue.length === 0 && <div className="px-4 py-6 text-center text-[12.5px] text-ink-faint">No elevated risk right now.</div>}
              {data.riskQueue.map((r: any) => (
                <button key={r.id} onClick={() => setSel(r.id)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left row-hover">
                  <RiskPill level={r.risk_level} score={r.risk_score} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-ink">{r.market} <span className="font-normal text-ink-faint">· {r.skill}</span></div>
                    <div className="truncate text-[11px] text-ink-faint">{r.drivers?.join(", ") || "—"}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted"><span className="text-ink-faint">Next:</span> {r.next_step}</div>
                  </div>
                  <div className="hidden text-right text-[11px] sm:block"><Owner name={r.owner} /></div>
                </button>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Right: decision queue + what changed + memo */}
        <div className="space-y-4">
          <SectionCard title="Decision queue" icon={<GitPullRequestArrow className="h-4 w-4" />} pad={false}>
            <div id="decision-queue" className="max-h-[320px] divide-y divide-line-soft overflow-y-auto">
              {data.decisionQueue.map((d: any, i: number) => (
                <button key={i} onClick={() => setSel(d.market_id)} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left row-hover">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${d.urgency === "High" ? "bg-rose-400" : d.urgency === "Medium" ? "bg-amber-400" : "bg-slate-500"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium text-ink">{d.type}</div>
                    <div className="truncate text-[11px] text-ink-faint">{d.market} · {d.skill}</div>
                  </div>
                  <span className="text-[10.5px] text-ink-faint">{d.urgency}</span>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="What changed since last update" icon={<History className="h-4 w-4" />}>
            <Timeline items={(data.changes || []).slice(0, 6).map((ch: any) => ({
              title: changeTitle(ch),
              meta: relTime(ch.changed_at),
              body: ch.reason,
              tone: ch.action === "status_change" ? "amber" : ch.action === "approved" ? "emerald" : ch.action === "escalated" ? "rose" : "slate",
            }))} />
          </SectionCard>

          <SectionCard title="Weekly leadership memo" icon={<ScrollText className="h-4 w-4" />}
            action={<button className="btn-ghost text-[12px]" onClick={() => { copyText(data.memo); toast("Memo copied"); }}><ClipboardCopy className="h-3.5 w-3.5" /></button>}>
            <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-ink-muted">{data.memo}</p>
          </SectionCard>
        </div>
      </div>

      <MarketDetail marketId={sel} onClose={() => setSel(null)} onChanged={reload} />
    </div>
  );
}

function changeTitle(ch: any) {
  if (ch.action === "status_change") return `${ch.entity_type} status ${ch.previous_value?.readiness_status || "?"} → ${ch.new_value?.readiness_status || "?"}`;
  if (ch.action === "escalated") return "Handoff escalated";
  if (ch.action === "approved") return "Leadership exception approved";
  if (ch.action === "update") return "Record updated";
  if (ch.action === "create") return "Record created";
  return ch.action;
}
