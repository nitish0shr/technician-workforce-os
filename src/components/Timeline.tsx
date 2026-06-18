import React from "react";
import { classNames as cx } from "../lib/format";

export interface TimelineItem {
  title: React.ReactNode;
  meta?: React.ReactNode;
  body?: React.ReactNode;
  tone?: "emerald" | "amber" | "rose" | "sky" | "violet" | "slate";
  icon?: React.ReactNode;
}

const DOT: Record<string, string> = {
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
  sky: "bg-sky-400",
  violet: "bg-violet-400",
  slate: "bg-slate-500",
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items.length)
    return <p className="text-[12px] text-ink-faint">No history recorded yet.</p>;
  return (
    <ol className="relative ml-1.5 space-y-4 border-l border-line pl-5">
      {items.map((it, i) => (
        <li key={i} className="relative animate-fade-in">
          <span className={cx("absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-surface", DOT[it.tone || "slate"])} />
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[12.5px] font-medium text-ink">{it.title}</p>
            {it.meta && <span className="shrink-0 text-[11px] text-ink-faint">{it.meta}</span>}
          </div>
          {it.body && <div className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">{it.body}</div>}
        </li>
      ))}
    </ol>
  );
}
