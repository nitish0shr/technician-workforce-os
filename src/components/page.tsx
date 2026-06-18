import React from "react";
import { classNames as cx } from "../lib/format";

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: string; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 section-label">{eyebrow}</div>}
        <h2 className="text-[27px] font-bold leading-[1.04] tracking-[-0.03em] text-ink">{title}</h2>
        {description && <p className="mt-2 max-w-[58ch] text-[13.5px] leading-relaxed text-ink-muted">{description}</p>}
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
  // Editorial KPI tile: hairline frame, the number does the talking. The icon is a
  // quiet monochrome glyph (tone only nudges it) — no filled color boxes.
  const accent: Record<string, string> = {
    ink: "text-ink-faint",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
    sky: "text-sky-600",
    violet: "text-violet-600",
  };
  return (
    <button
      onClick={onClick}
      className={cx(
        "group flex flex-col gap-3 rounded-xl border bg-surface p-4 text-left transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        active ? "border-brand/40 bg-brand/[0.03]" : "border-line",
        onClick && "cursor-pointer hover:border-line-strong hover:bg-surface-hover"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="section-label">{label}</span>
        {icon && <span className={cx("shrink-0 [&>svg]:h-4 [&>svg]:w-4", accent[tone] || accent.ink)}>{icon}</span>}
      </div>
      <div className="text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink">{value}</div>
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
