import React from "react";
import { useNavigate } from "react-router-dom";
import { ListChecks, ArrowUpRight } from "lucide-react";
import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { PageHeader, Owner } from "../components/page";
import { Loading, ErrorState } from "../components/primitives";
import { classNames as cx } from "../lib/format";

const SEV = [
  { key: "Critical", rail: "bg-red-600", dot: "bg-red-600", label: "Critical" },
  { key: "High", rail: "bg-red-500", dot: "bg-red-500", label: "High priority" },
  { key: "Medium", rail: "bg-amber-500", dot: "bg-amber-500", label: "Medium" },
  { key: "Low", rail: "bg-zinc-400", dot: "bg-zinc-400", label: "Low" },
];

export default function ActionCenter() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync<any>(() => api.actionCenter(), []);
  if (loading) return <Loading label="Building today's worklist" />;
  if (error || !data) return <ErrorState message={error || "No data"} retry={reload} />;

  const items: any[] = data.items || [];

  return (
    <div>
      <PageHeader
        title="Action Center"
        description="Everything that needs attention today — where to hire, where to pause, where to fix capacity, and where to investigate before hiring. Each item leads to an action."
      />

      {/* Count strip by kind */}
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
        <span className="text-[13px] font-semibold text-ink">{data.total} open</span>
        {Object.entries(data.byKind).map(([kind, count]: any) => (
          <span key={kind} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted">
            <span className="text-ink-faint">{kind}</span>
            <span className="font-semibold tabular-nums text-ink">{count}</span>
          </span>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface/40 px-6 py-16 text-center text-[13px] text-ink-faint">Nothing needs attention right now.</div>
      ) : (
        <div className="space-y-6">
          {SEV.map((sev) => {
            const group = items.filter((i) => i.severity === sev.key);
            if (!group.length) return null;
            return (
              <section key={sev.key}>
                <div className="mb-2.5 flex items-center gap-2.5">
                  <span className={cx("h-2 w-2 rounded-full", sev.dot)} />
                  <span className="text-[12.5px] font-semibold text-ink">{sev.label}</span>
                  <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-muted">{group.length}</span>
                  <span className="h-px flex-1 bg-line" />
                </div>
                <div className="space-y-2">
                  {group.map((it, i) => (
                    <div key={i} className="card flex items-start gap-3 p-3.5 transition-shadow hover:shadow-cardLg">
                      <span className={cx("mt-0.5 w-1 shrink-0 self-stretch rounded-full", sev.rail)} />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="chip">{it.kind}</span>
                          <span className="text-[13.5px] font-medium text-ink">{it.title}</span>
                        </div>
                        <p className="text-[12.5px] leading-relaxed text-ink-muted">{it.detail}</p>
                        <div className="mt-1.5 text-[11px] text-ink-faint"><Owner name={it.owner} /></div>
                      </div>
                      <button className="btn-ghost shrink-0 text-[12px]" onClick={() => navigate(it.link)}>
                        Open <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
