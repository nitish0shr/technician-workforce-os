import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";
import { FlaskConical, Play, TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { PageHeader } from "../components/page";
import { Loading, ErrorState, Spinner } from "../components/primitives";
import { toast } from "../components/toast";
import { classNames as cx } from "../lib/format";

const SCENARIOS = [
  { key: "hire_2_per_area", label: "Hire 2 per planning area", desc: "Add two starts to every planning area and see where capacity strains.", param: null },
  { key: "top_20_ready", label: "Prioritize top 20 ready markets", desc: "Concentrate starts on the 20 highest-priority markets; pause the rest.", param: null },
  { key: "increase_demand", label: "Increase demand", desc: "Model a marketing-driven lift in work volume and forecast.", param: "pct" },
  { key: "reduce_mentor", label: "Reduce mentor capacity by 1", desc: "Stress-test a loss of one mentor in every market.", param: null },
  { key: "add_starts", label: "Add pending starts", desc: "Add starts to selected markets (or all) and watch mentor overload.", param: "starts" },
  { key: "shift_part_time", label: "Shift to part-time where thin", desc: "Convert thin-forecast markets to part-time coverage.", param: null },
];

const METRICS = [
  { key: "ready", label: "Ready markets", better: "up" },
  { key: "atRisk", label: "At-risk markets", better: "down" },
  { key: "blocked", label: "Go-live blocked", better: "down" },
  { key: "overloadStarts", label: "Mentor-overload starts", better: "down" },
  { key: "demandNeeded", label: "Demand support needed", better: "down" },
];

export default function ScenarioLab() {
  const { data: markets, loading } = useAsync<any[]>(() => api.markets(), []);
  const [scenario, setScenario] = useState("top_20_ready");
  const [pct, setPct] = useState(20);
  const [count, setCount] = useState(2);
  const [marketIds, setMarketIds] = useState<number[]>([]);
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);

  const def = SCENARIOS.find((s) => s.key === scenario)!;

  async function run() {
    setRunning(true);
    try {
      const params: any = {};
      if (def.param === "pct") params.pct = pct;
      if (def.param === "starts") { params.count = count; params.market_ids = marketIds; }
      const r = await api.runScenario(scenario, params);
      setResult(r);
    } catch (e: any) { toast(e.message || "Scenario failed", "error"); } finally { setRunning(false); }
  }

  if (loading) return <Loading label="Loading scenario lab" />;

  return (
    <div>
      <PageHeader
        title="Scenario Lab"
        description="Model hiring strategies against the current market set. Nothing is saved — this is a sandbox for testing trade-offs before you commit."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: pick scenario */}
        <div className="space-y-2.5 lg:col-span-5">
          {SCENARIOS.map((s) => (
            <button key={s.key} onClick={() => { setScenario(s.key); setResult(null); }}
              className={cx("card w-full p-3.5 text-left transition-all", scenario === s.key ? "border-brand/40 bg-surface-hover ring-1 ring-brand/30" : "hover:border-line hover:bg-surface-hover/40")}>
              <div className="flex items-center gap-2">
                <FlaskConical className={cx("h-4 w-4", scenario === s.key ? "text-brand-soft" : "text-ink-faint")} />
                <span className="text-[13.5px] font-semibold text-ink">{s.label}</span>
              </div>
              <p className="mt-1 pl-6 text-[12px] text-ink-muted">{s.desc}</p>

              {scenario === s.key && s.param && (
                <div className="mt-3 pl-6" onClick={(e) => e.stopPropagation()}>
                  {s.param === "pct" && (
                    <div className="flex items-center gap-2">
                      {[10, 20, 30].map((p) => (
                        <button key={p} onClick={() => setPct(p)} className={cx("pill border", pct === p ? "border-brand/40 bg-brand/15 text-ink" : "border-line text-ink-faint")}>+{p}%</button>
                      ))}
                    </div>
                  )}
                  {s.param === "starts" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-ink-faint">Add</span>
                        {[1, 2, 3].map((n) => (
                          <button key={n} onClick={() => setCount(n)} className={cx("pill border", count === n ? "border-brand/40 bg-brand/15 text-ink" : "border-line text-ink-faint")}>{n}</button>
                        ))}
                        <span className="text-[11px] text-ink-faint">start(s) to {marketIds.length ? `${marketIds.length} selected` : "all markets"}</span>
                      </div>
                      <details className="rounded-lg border border-line bg-surface px-2.5 py-1.5">
                        <summary className="cursor-pointer text-[11.5px] text-ink-muted">Select specific markets</summary>
                        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                          {(markets || []).map((m) => (
                            <label key={m.id} className="flex items-center gap-2 text-[11.5px] text-ink-muted">
                              <input type="checkbox" checked={marketIds.includes(m.id)} onChange={(e) => setMarketIds((ids) => e.target.checked ? [...ids, m.id] : ids.filter((x) => x !== m.id))} />
                              {m.market} · {m.skill_type}
                            </label>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              )}
            </button>
          ))}
          <button className="btn-primary w-full justify-center" onClick={run} disabled={running}>
            {running ? <><Spinner className="h-3.5 w-3.5" /> Running…</> : <><Play className="h-3.5 w-3.5" /> Run scenario</>}
          </button>
        </div>

        {/* Right: results */}
        <div className="lg:col-span-7">
          {!result ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface/30 text-center">
              <FlaskConical className="mb-3 h-8 w-8 text-ink-faint" />
              <p className="text-[13px] font-medium text-ink">Run a scenario to see the impact</p>
              <p className="mt-1 max-w-sm text-[12px] text-ink-faint">Choose a strategy on the left and press Run. Results compare against the current live market set.</p>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              <div className="card-raised p-4">
                <div className="mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-soft" /><span className="panel-title">Recommendation summary</span></div>
                <p className="text-[14px] leading-relaxed text-ink">{result.summary}</p>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {METRICS.map((m) => <ImpactCard key={m.key} m={m} baseline={result.baseline[m.key]} value={result.result[m.key]} delta={result.delta[m.key]} />)}
              </div>

              <div className="card p-4">
                <div className="mb-3 panel-title text-ink-muted">Baseline vs scenario</div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={METRICS.map((m) => ({ name: m.label, Baseline: result.baseline[m.key], Scenario: result.result[m.key] }))} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f4" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#8b95a5", fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={56} />
                    <YAxis tick={{ fill: "#8b95a5", fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e4e7ec", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 12px -2px rgba(16,24,40,0.12)", color: "#1a1f29" }} labelStyle={{ color: "#1a1f29" }} cursor={{ fill: "rgba(16,24,40,0.04)" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Baseline" fill="#cbd2dc" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Scenario" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImpactCard({ m, baseline, value, delta }: any) {
  const improved = m.better === "up" ? delta > 0 : delta < 0;
  const worse = m.better === "up" ? delta < 0 : delta > 0;
  const Icon = delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const tone = delta === 0 ? "text-ink-faint" : improved ? "text-emerald-600" : worse ? "text-rose-600" : "text-ink-muted";
  return (
    <div className="card p-3.5">
      <div className="section-label">{m.label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[22px] font-semibold tabular-nums text-ink">{value}</span>
        <span className="text-[12px] text-ink-faint">from {baseline}</span>
      </div>
      <div className={cx("mt-1 inline-flex items-center gap-1 text-[12px] font-medium", tone)}>
        <Icon className="h-3.5 w-3.5" /> {delta > 0 ? "+" : ""}{delta} {improved ? "· better" : worse ? "· worse" : "· no change"}
      </div>
    </div>
  );
}
