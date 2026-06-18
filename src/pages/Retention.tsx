import React from "react";
import { Users, TrendingDown, UserMinus, Sprout, MapPin, AlertTriangle, MessageSquareWarning, Layers, Workflow } from "lucide-react";
import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { PageHeader, SectionCard, StatCard } from "../components/page";
import { DataTable, Col } from "../components/DataTable";
import { Loading, ErrorState } from "../components/primitives";
import { classNames as cx } from "../lib/format";

export default function Retention() {
  const { data, loading, error, reload } = useAsync<any>(() => api.retention(), []);

  if (loading) return <Loading label="Loading retention" />;
  if (error || !data) return <ErrorState message={error || "No data"} retry={reload} />;

  const byMarket = [...(data.byMarket || [])].sort((a: any, b: any) => b.attrition_rate - a.attrition_rate);
  const reasonMax = Math.max(1, ...(data.byReason || []).map((r: any) => r.count));

  const columns: Col<any>[] = [
    { id: "market", header: "Market", accessor: (m) => m.market, cell: (m) => <span className="font-medium text-ink">{m.market}</span> },
    { id: "active", header: "Active", align: "right", accessor: (m) => m.active, cell: (m) => <span className="tabular-nums text-ink-muted">{m.active}</span> },
    { id: "exits_90d", header: "Exits (90d)", align: "right", accessor: (m) => m.exits_90d, cell: (m) => <span className="tabular-nums text-ink-muted">{m.exits_90d}</span> },
    {
      id: "attrition_rate", header: "Attrition rate", align: "right", accessor: (m) => m.attrition_rate,
      cell: (m) => (
        <span className={cx("tabular-nums", m.attrition_rate >= 20 ? "text-red-600 font-semibold" : m.attrition_rate >= 12 ? "text-amber-700" : "text-ink")}>
          {m.attrition_rate}%
        </span>
      ),
    },
    { id: "early_attrition", header: "Early exits", align: "right", accessor: (m) => m.early_attrition, cell: (m) => <span className="tabular-nums text-ink-muted">{m.early_attrition}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Retention"
        description="Where and why technicians are leaving — and where high attrition collides with high demand. Hiring alone won't fix a retention problem."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active technicians" value={data.active} tone="ink" icon={<Users className="h-4 w-4" />} />
        <StatCard label="90-day attrition" value={`${data.attrition_rate}%`} tone="rose" icon={<TrendingDown className="h-4 w-4" />} />
        <StatCard label="Early exits ≤90d" value={data.early.d90} tone="amber" icon={<UserMinus className="h-4 w-4" />} />
        <StatCard label="Green-tech share" value={`${data.greenShare}%`} tone="sky" icon={<Sprout className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Attrition by market" icon={<MapPin className="h-4 w-4" />}>
            <DataTable
              data={byMarket}
              columns={columns}
              search={false}
              initialSort={[{ id: "attrition_rate", desc: true }]}
              getRowId={(m) => String(m.market)}
            />
          </SectionCard>

          <SectionCard title="Watch-outs — demand + attrition" icon={<AlertTriangle className="h-4 w-4" />} pad={false}>
            {(data.watchouts || []).length === 0 ? (
              <div className="px-4 py-8 text-center text-[12.5px] text-ink-faint">
                No markets are pairing high attrition with high demand right now. Keep an eye on the table above.
              </div>
            ) : (
              <div className="divide-y divide-line-soft">
                {data.watchouts.map((w: any) => (
                  <div key={w.market} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 h-[7px] w-[7px] shrink-0 rounded-full bg-amber-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium text-ink">{w.market}</span>
                        <span className="chip">{w.demand} demand</span>
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                        {w.attrition_rate}% attrition with {w.demand} demand — investigate before increasing hiring.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Why they leave" icon={<MessageSquareWarning className="h-4 w-4" />}>
            <div className="space-y-2.5">
              {(data.byReason || []).map((r: any) => (
                <div key={r.key} className="flex items-center gap-3">
                  <span className="w-28 truncate text-[12px] text-ink-muted">{r.key}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-line-soft">
                    <div className="h-full rounded-full bg-brand/55" style={{ width: `${(r.count / reasonMax) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-[12.5px] font-semibold tabular-nums text-ink">{r.count}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="By type" icon={<Layers className="h-4 w-4" />}>
            <div className="space-y-1.5 text-[12.5px]">
              {(data.byType || []).map((t: any) => (
                <div key={t.key} className="flex items-center justify-between">
                  <span className="text-ink-muted">{t.key}</span>
                  <span className="tabular-nums text-ink">{t.count}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Attrition by source" icon={<Workflow className="h-4 w-4" />}>
            <div className="space-y-1.5 text-[12.5px]">
              {(data.bySource || []).map((s: any) => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="text-ink-muted">{s.key}</span>
                  <span className="tabular-nums text-ink">{s.count}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
