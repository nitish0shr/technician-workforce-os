import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { classNames as cx } from "../lib/format";

function useEsc(onClose: () => void, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

function useInitialFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);
  return ref;
}

export function Drawer({
  open, onClose, title, subtitle, headerExtra, children, footer, width = 560,
}: {
  open: boolean; onClose: () => void; title?: React.ReactNode; subtitle?: React.ReactNode;
  headerExtra?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; width?: number;
}) {
  useEsc(onClose, open);
  const panelRef = useInitialFocus(open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="absolute right-0 top-0 flex h-full flex-col border-l border-line bg-surface shadow-drawer outline-none animate-slide-in"
        style={{ width: Math.min(width, window.innerWidth - 24) }}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              {subtitle && <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">{subtitle}</div>}
              <div className="truncate text-[15px] font-semibold text-ink">{title}</div>
              {headerExtra && <div className="mt-2">{headerExtra}</div>}
            </div>
            <button className="btn-ghost -mr-1.5 mt-0.5" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line bg-surface-raised/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Modal({
  open, onClose, title, children, footer, width = 520,
}: {
  open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; width?: number;
}) {
  useEsc(onClose, open);
  const panelRef = useInitialFocus(open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" className="card-raised relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden outline-none animate-fade-in" style={{ maxWidth: width }}>
        {title && (
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="text-[14px] font-semibold text-ink">{title}</div>
            <button className="btn-ghost -mr-1.5" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line bg-surface/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1.5", className)}>
      <span className="text-[12px] font-medium text-ink-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
    </label>
  );
}

export function Disclosure({ summary, children, defaultOpen = false }: { summary: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-lg border border-line bg-surface-raised/50">
      <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left" onClick={() => setOpen((o) => !o)}>
        <span className="text-[12.5px] font-medium text-ink">{summary}</span>
        <span className={cx("text-ink-faint transition-transform", open && "rotate-90")}>›</span>
      </button>
      {open && <div className="border-t border-line-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-muted animate-fade-in">{children}</div>}
    </div>
  );
}
