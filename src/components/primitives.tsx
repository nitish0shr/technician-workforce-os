import React from "react";
import { classNames as cx } from "../lib/format";
import {
  STATUS_DOT, riskDot, goLiveDot, modeDot, severityDot, demandDot, trainingDot,
} from "../lib/status";
import { Inbox } from "lucide-react";

export function Pill({ className, children, dot }: { className?: string; children: React.ReactNode; dot?: string }) {
  return (
    <span className={cx("pill", className)}>
      {dot && <span className={cx("h-[7px] w-[7px] shrink-0 rounded-full", dot)} />}
      {children}
    </span>
  );
}

export const StatusPill = ({ status }: { status: string }) => (
  <Pill dot={STATUS_DOT[status] || "bg-zinc-400"}>{status}</Pill>
);

export const RiskPill = ({ level, score }: { level: string; score?: number }) => (
  <Pill dot={riskDot(level)}>
    {level}
    {score !== undefined && <span className="text-ink-faint">· {score}</span>}
  </Pill>
);

export const GoLivePill = ({ status }: { status: string }) => <Pill dot={goLiveDot(status)}>{status}</Pill>;
export const ModePill = ({ mode }: { mode: string }) => <Pill dot={modeDot(mode)}>{mode}</Pill>;
export const SeverityPill = ({ sev }: { sev: string }) => <Pill dot={severityDot(sev)}>{sev}</Pill>;
export const DemandPill = ({ status }: { status: string }) => <Pill dot={demandDot(status)}>{status} demand</Pill>;
export const TrainingPill = ({ status }: { status: string }) => <Pill dot={trainingDot(status)}>Training: {status}</Pill>;

const TONE: Record<string, string> = {
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
  sky: "bg-sky-400",
  violet: "bg-violet-400",
  brand: "bg-brand",
  slate: "bg-slate-400",
};

// Compact inline trend line (area + stroke), single accent. The signature element
// that turns a flat number into a "this is a real product" metric.
export function Sparkline({ data, width = 104, height = 30, className, strokeClass = "stroke-brand", fillClass = "fill-brand/10" }: { data: number[]; width?: number; height?: number; className?: string; strokeClass?: string; fillClass?: string }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const y = (v: number) => height - 2 - ((v - min) / span) * (height - 5);
  const pts = data.map((v, i) => [i * stepX, y(v)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${width.toFixed(1)},${height} L0,${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none" aria-hidden>
      <path d={area} className={fillClass} stroke="none" />
      <path d={line} className={strokeClass} fill="none" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r={1.8} className={strokeClass.replace("stroke", "fill")} />
    </svg>
  );
}

// Signed trend badge — ▲/▼ with tone. Up isn't always good, so callers pass `goodWhenUp`.
export function Delta({ value, suffix = "", goodWhenUp = true, className }: { value: number; suffix?: string; goodWhenUp?: boolean; className?: string }) {
  if (value === 0) return <span className={cx("inline-flex items-center gap-0.5 text-[11.5px] font-medium text-ink-faint", className)}>± 0{suffix}</span>;
  const up = value > 0;
  const good = up === goodWhenUp;
  return (
    <span className={cx("inline-flex items-center gap-0.5 text-[11.5px] font-medium tabular-nums", good ? "text-emerald-600" : "text-rose-600", className)}>
      {up ? "▲" : "▼"} {Math.abs(value)}{suffix}
    </span>
  );
}

export function ScoreBar({ value, tone = "brand", className }: { value: number; tone?: string; className?: string }) {
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-line", className)}>
      <div className={cx("h-full rounded-full transition-all", TONE[tone] || TONE.brand)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

export function ScoreRing({ value, size = 44, tone = "brand", label }: { value: number; size?: number; tone?: string; label?: string }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  const color = tone === "emerald" ? "#10b981" : tone === "amber" ? "#f59e0b" : tone === "rose" ? "#f43f5e" : tone === "violet" ? "#8b5cf6" : "#2d5be8";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e4e7ec" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" className="transition-all" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-[13px] font-semibold leading-none text-ink">{value}</span>
        {label && <span className="mt-0.5 text-[8px] uppercase tracking-wide text-ink-faint">{label}</span>}
      </div>
    </div>
  );
}

export function Metric({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="section-label">{label}</span>
      <span className={cx("text-[15px] font-semibold tabular-nums text-ink", tone)}>{value}</span>
      {sub && <span className="text-[11px] text-ink-faint">{sub}</span>}
    </div>
  );
}

export function Confidence({ value }: { value: number }) {
  const tone = value >= 80 ? "text-emerald-600" : value >= 60 ? "text-amber-600" : "text-rose-600";
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      <span className={tone}>{value}%</span> confidence
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span className={cx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand", className)} />
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-ink-faint">
      <Spinner className="h-6 w-6" />
      <span className="text-[13px]">{label}…</span>
    </div>
  );
}

export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="shimmer h-11 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface/40 px-6 py-12 text-center">
      <div className="mb-1 text-ink-faint">{icon || <Inbox className="h-6 w-6" />}</div>
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {hint && <p className="max-w-sm text-[12px] text-ink-faint">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-6 py-12 text-center">
      <p className="text-[13px] font-medium text-rose-600">Something went wrong</p>
      <p className="max-w-sm text-[12px] text-ink-muted">{message}</p>
      {retry && <button className="btn" onClick={retry}>Retry</button>}
    </div>
  );
}

export function LastUpdated({ date }: { date?: string | null }) {
  return <span className="text-[11px] text-ink-faint">Updated {date ? new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</span>;
}

export function Divider() {
  return <div className="my-3 h-px w-full bg-line-soft" />;
}
