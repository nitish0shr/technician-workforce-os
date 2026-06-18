import React, { useEffect, useState } from "react";
import { SlidersHorizontal, RotateCcw, Save, Info } from "lucide-react";
import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { PageHeader } from "../components/page";
import { Loading, ErrorState } from "../components/primitives";
import { toast } from "../components/toast";
import type { Rule } from "../lib/types";
import { classNames as cx } from "../lib/format";

const CATEGORY_ORDER = ["Demand", "Readiness", "Risk", "Capacity", "Go-Live", "Priority", "Governance"];

function humanize(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace("Sla", "SLA");
}

export default function OperatingRules() {
  const { data, loading, error, reload } = useAsync<Rule[]>(() => api.rules(), []);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDraft(Object.fromEntries(data.map((r) => [r.rule_name, r.rule_value])));
  }, [data]);

  if (loading) return <Loading label="Loading operating rules" />;
  if (error || !data) return <ErrorState message={error || "No data"} retry={reload} />;

  const dirty = data.filter((r) => draft[r.rule_name] !== undefined && Number(draft[r.rule_name]) !== Number(r.rule_value));
  const byCat: Record<string, Rule[]> = {};
  for (const r of data) (byCat[r.category] = byCat[r.category] || []).push(r);
  const cats = CATEGORY_ORDER.filter((c) => byCat[c]).concat(Object.keys(byCat).filter((c) => !CATEGORY_ORDER.includes(c)));

  async function save() {
    setSaving(true);
    try {
      await api.updateRules(dirty.map((r) => ({ rule_name: r.rule_name, rule_value: Number(draft[r.rule_name]) })));
      toast(`${dirty.length} rule${dirty.length === 1 ? "" : "s"} updated — recommendations recalculated`);
      reload();
    } catch (e: any) { toast(e.message || "Save failed", "error"); } finally { setSaving(false); }
  }
  async function reset() {
    setSaving(true);
    try { await api.resetRules(); toast("Rules reset to defaults"); reload(); }
    catch (e: any) { toast(e.message || "Reset failed", "error"); } finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader
        title="Operating Rules"
        description="The thresholds that drive every recommendation. Editing a rule re-scores all markets immediately — changes are audited."
        actions={
          <>
            <button className="btn" onClick={reset} disabled={saving}><RotateCcw className="h-3.5 w-3.5" /> Reset to defaults</button>
            <button className="btn-primary" onClick={save} disabled={saving || dirty.length === 0}><Save className="h-3.5 w-3.5" /> {dirty.length ? `Save ${dirty.length} change${dirty.length === 1 ? "" : "s"}` : "Saved"}</button>
          </>
        }
      />

      {dirty.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
          <Info className="h-4 w-4" /> {dirty.length} unsaved change{dirty.length === 1 ? "" : "s"}. Recommendations update when you save.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cats.map((cat) => (
          <section key={cat} className="card">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <SlidersHorizontal className="h-4 w-4 text-ink-faint" />
              <span className="panel-title">{cat}</span>
            </div>
            <div className="divide-y divide-line-soft">
              {byCat[cat].map((r) => {
                const changed = Number(draft[r.rule_name]) !== Number(r.rule_value);
                return (
                  <div key={r.rule_name} className="flex items-start justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-ink">{humanize(r.rule_name)}</div>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-faint">{r.description}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <div className={cx("flex items-center overflow-hidden rounded-lg border bg-canvas", changed ? "border-amber-500/40" : "border-line")}>
                        <input
                          type="number"
                          className="w-20 bg-transparent px-2.5 py-1.5 text-right text-[13px] tabular-nums text-ink outline-none"
                          value={draft[r.rule_name] ?? ""}
                          onChange={(e) => setDraft({ ...draft, [r.rule_name]: e.target.value === "" ? 0 : Number(e.target.value) })}
                          step="any"
                        />
                        <span className="border-l border-line bg-surface-raised px-2 py-1.5 text-[10.5px] text-ink-faint">{r.unit}</span>
                      </div>
                      {changed && <span className="text-[10px] text-amber-700">was {r.rule_value}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
