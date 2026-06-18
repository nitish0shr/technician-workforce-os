import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Search, CornerDownLeft, ChevronDown, RefreshCw, Menu } from "lucide-react";
import { NAV, PRIMARY, SECONDARY, MORE_GROUPS } from "../nav";
import { Modal } from "./overlays";
import { StatusPill } from "./primitives";
import { classNames as cx } from "../lib/format";
import type { Market } from "../lib/types";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45",
    isActive ? "bg-surface-hover text-ink shadow-card" : "text-ink-muted hover:bg-surface-hover/60 hover:text-ink"
  );

export function TopNav({ markets }: { markets: Market[] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);          // command palette
  const [more, setMore] = useState(false);          // More dropdown
  const [mobile, setMobile] = useState(false);       // mobile nav sheet
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const flat = useMemo(() => {
    const term = q.trim().toLowerCase();
    const pages = NAV.filter((n) => !term || n.label.toLowerCase().includes(term)).slice(0, 5).map((p) => ({ kind: "page" as const, key: p.path, item: p }));
    const mk = markets.filter((m) => !term || `${m.market} ${m.skill_type} ${m.planning_area}`.toLowerCase().includes(term)).slice(0, 7).map((m) => ({ kind: "market" as const, key: `m${m.id}`, item: m }));
    return [...pages, ...mk];
  }, [q, markets]);
  useEffect(() => { setActive(0); }, [q, open]);
  useEffect(() => { itemRefs.current[active]?.scrollIntoView({ block: "nearest" }); }, [active]);

  function go(entry: (typeof flat)[number]) {
    navigate(entry.kind === "page" ? entry.item.path : `/market-readiness?market=${entry.item.id}`);
    setOpen(false); setQ("");
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && flat[active]) { e.preventDefault(); go(flat[active]); }
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const pageCount = flat.filter((f) => f.kind === "page").length;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-[56px] w-full max-w-[1480px] items-center gap-3 px-4 sm:px-6">
        {/* Logo */}
        <NavLink to="/" className="flex shrink-0 items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[linear-gradient(135deg,#6366F1,#4F46E5_55%,#7A5AF8)] shadow-[0_6px_16px_rgba(79,70,229,.35),inset_0_1px_0_rgba(255,255,255,.25)]">
            <svg width="17" height="17" viewBox="0 0 32 32"><path d="M9 22V12M16 22V8M23 22v-7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /><circle cx="9" cy="12" r="2.2" fill="#a5b4fc" /><circle cx="16" cy="8" r="2.2" fill="#fff" /><circle cx="23" cy="15" r="2.2" fill="#fcd34d" /></svg>
          </div>
          <span className="hidden text-[14px] font-semibold tracking-tight text-ink md:inline">Workforce OS</span>
        </NavLink>

        {/* Primary tabs (desktop) */}
        <nav className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto lg:flex">
          {PRIMARY.map((n) => (
            <NavLink key={n.path} to={n.path} end={n.path === "/"} className={tabClass}>
              <n.icon className="h-[15px] w-[15px]" /> {n.label}
            </NavLink>
          ))}
          {/* More */}
          <div className="relative">
            <button onClick={() => setMore((o) => !o)} className={cx("inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-hover/60 hover:text-ink", more && "bg-surface-hover text-ink")}>
              More <ChevronDown className={cx("h-3.5 w-3.5 transition-transform", more && "rotate-180")} />
            </button>
            {more && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMore(false)} />
                <div className="absolute right-0 z-20 mt-1.5 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-pop">
                  {MORE_GROUPS.map((g) => {
                    const items = SECONDARY.filter((n) => n.group === g);
                    if (!items.length) return null;
                    return (
                      <div key={g} className="mb-1 last:mb-0">
                        <div className="px-2.5 pb-0.5 pt-1.5 section-label">{g}</div>
                        {items.map((n) => (
                          <button key={n.path} onClick={() => { navigate(n.path); setMore(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-muted row-hover hover:text-ink">
                            <n.icon className="h-[15px] w-[15px] text-ink-faint" /> {n.label}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </nav>

        <div className="flex flex-1 lg:hidden" />

        {/* Right actions */}
        <div className="flex shrink-0 items-center gap-2">
          <button className="btn gap-2 text-ink-muted" onClick={() => setOpen(true)}>
            <Search className="h-3.5 w-3.5" /> <span className="kbd ml-0.5 hidden sm:inline">⌘K</span>
          </button>
          <button className="btn" onClick={() => window.location.reload()} title="Refresh data">
            <RefreshCw className="h-3.5 w-3.5" /> <span className="hidden md:inline">Refresh</span>
          </button>
          <span className="hidden rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 text-[12px] text-ink-faint xl:inline">{today}</span>
          <button className="btn-ghost px-2 lg:hidden" onClick={() => setMobile((o) => !o)} aria-label="Menu"><Menu className="h-5 w-5" /></button>
        </div>
      </div>

      {/* Mobile nav sheet */}
      {mobile && (
        <div className="border-t border-line bg-canvas px-4 py-2 lg:hidden">
          <div className="grid grid-cols-2 gap-1">
            {NAV.map((n) => (
              <NavLink key={n.path} to={n.path} end={n.path === "/"} onClick={() => setMobile(false)} className={({ isActive }) => cx("flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium", isActive ? "bg-surface-hover text-ink" : "text-ink-muted")}>
                <n.icon className="h-[15px] w-[15px] text-ink-faint" /> {n.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* Command palette */}
      <Modal open={open} onClose={() => setOpen(false)} title={null as any} width={560}>
        <div className="-mx-5 -my-4">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Search className="h-4 w-4 text-ink-faint" />
            <input autoFocus role="combobox" aria-expanded aria-controls="cmdk" className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-faint" placeholder="Jump to a page or market…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
            <span className="kbd">esc</span>
          </div>
          <div id="cmdk" role="listbox" className="max-h-[52vh] overflow-y-auto px-2 py-2">
            <div className="px-2 pb-1 pt-1 section-label">Pages</div>
            {flat.filter((f) => f.kind === "page").map((entry, i) => {
              const p = entry.item as (typeof NAV)[number];
              return (
                <button key={entry.key} ref={(el) => (itemRefs.current[i] = el)} role="option" aria-selected={active === i} onMouseEnter={() => setActive(i)} onClick={() => go(entry)}
                  className={cx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left", active === i ? "bg-surface-hover" : "row-hover")}>
                  <p.icon className="h-4 w-4 text-ink-faint" /><span className="text-[13px] text-ink">{p.label}</span><span className="ml-auto text-[11px] text-ink-faint">{p.group}</span>
                </button>
              );
            })}
            {flat.some((f) => f.kind === "market") && <div className="px-2 pb-1 pt-3 section-label">Markets</div>}
            {flat.filter((f) => f.kind === "market").map((entry, i) => {
              const m = entry.item as Market; const idx = pageCount + i;
              return (
                <button key={entry.key} ref={(el) => (itemRefs.current[idx] = el)} role="option" aria-selected={active === idx} onMouseEnter={() => setActive(idx)} onClick={() => go(entry)}
                  className={cx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left", active === idx ? "bg-surface-hover" : "row-hover")}>
                  <div className="min-w-0 flex-1"><div className="truncate text-[13px] text-ink">{m.market} · <span className="text-ink-muted">{m.skill_type}</span></div><div className="truncate text-[11px] text-ink-faint">{m.planning_area}</div></div>
                  <StatusPill status={m.rec.readiness_status} />
                </button>
              );
            })}
            {flat.length === 0 && <div className="px-3 py-8 text-center text-[12px] text-ink-faint">No matches for “{q}”.</div>}
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-ink-faint">
            <span className="inline-flex items-center gap-1.5"><CornerDownLeft className="h-3 w-3" /> to open · ↑↓ to navigate</span>
            <span>Technician hiring & retention intelligence</span>
          </div>
        </div>
      </Modal>
    </header>
  );
}
