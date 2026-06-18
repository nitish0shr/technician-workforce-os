import React from "react";
import { classNames as cx } from "../lib/format";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[23px] font-bold tracking-[-0.022em] text-ink">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-[13.5px] text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionCard({ title, icon, action, children, className, pad = true }: { title?: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx("card", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2 text-ink-muted">
            {icon}
            <span className="panel-title">{title}</span>
          </div>
          {action}
        </div>
      )}
      <div className={cx(pad && "p-4")}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, icon, tone = "ink", onClick, active }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; tone?: string; onClick?: () => void; active?: boolean }) {
  // Calm, premium KPI card: a tinted icon box carries the color; the value stays dark.
  const tintMap: Record<string, string> = {
    ink: "bg-slate-100 text-slate-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    sky: "bg-sky-50 text-sky-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <button
      onClick={onClick}
      className={cx(
        "card group flex flex-col gap-2.5 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:border-line hover:bg-surface-hover hover:shadow-cardLg",
        active && "ring-1 ring-brand/40"
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg", tintMap[tone] || tintMap.ink)}>{icon}</span>
        <span className="section-label">{label}</span>
      </div>
      <div className="text-[30px] font-bold leading-none tracking-[-0.02em] tabular-nums text-ink">{value}</div>
      {hint && <div className="text-[11.5px] text-ink-faint">{hint}</div>}
    </button>
  );
}

export function Owner({ name }: { name?: string | null }) {
  if (!name) return <span className="text-ink-faint">Unassigned</span>;
  const initials = name.split(/[\s—-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="grid h-5 w-5 place-items-center rounded-full border border-line bg-surface-raised text-[9px] font-semibold text-ink-muted">{initials}</span>
      <span className="text-ink-muted">{name}</span>
    </span>
  );
}
