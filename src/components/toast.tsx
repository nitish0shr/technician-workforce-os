import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { classNames as cx } from "../lib/format";

type Toast = { id: number; kind: "success" | "error" | "info"; msg: string };
let counter = 0;
const listeners = new Set<(t: Toast[]) => void>();
let toasts: Toast[] = [];

function emit() {
  listeners.forEach((l) => l([...toasts]));
}
export function toast(msg: string, kind: Toast["kind"] = "success") {
  const t = { id: ++counter, kind, msg };
  toasts = [...toasts, t];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    emit();
  }, 3800);
}

const ICON = { success: CheckCircle2, error: AlertTriangle, info: Info };
const TONE = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
};

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    listeners.add(setItems);
    return () => { listeners.delete(setItems); };
  }, []);
  return (
    <div role="status" aria-live="polite" aria-atomic="false" className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-80 flex-col gap-2">
      {items.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div key={t.id} className={cx("pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3 py-2.5 shadow-pop backdrop-blur animate-slide-in", TONE[t.kind])}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1 text-[12.5px] leading-snug text-ink">{t.msg}</span>
            <button className="text-ink-faint hover:text-ink" onClick={() => { toasts = toasts.filter((x) => x.id !== t.id); emit(); }}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
