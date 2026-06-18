import {
  LayoutDashboard, ListChecks, Target, Scale, CalendarClock, HeartPulse, LayoutGrid,
  ShieldCheck, Megaphone, FlaskConical, Activity, SlidersHorizontal, Waves,
} from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  icon: any;
  group: string;
  blurb: string;
  primary?: boolean; // shown as a top-nav tab; others live under "More"
}

export const NAV: NavItem[] = [
  // The product answers one question: where to hire, where to pause / stop.
  { path: "/", label: "Req Planner", icon: LayoutGrid, group: "Hiring", blurb: "Reqs to open & close by planning area", primary: true },
  { path: "/overview", label: "Overview", icon: LayoutDashboard, group: "Hiring", blurb: "Daily hire vs. pause cockpit", primary: true },
  { path: "/demand-supply", label: "Demand & Supply", icon: Scale, group: "Hiring", blurb: "Where to hire vs. where to pause", primary: true },
  { path: "/market-readiness", label: "Market Readiness", icon: Target, group: "Hiring", blurb: "Per-market hire / hold / pause", primary: true },
  { path: "/retention", label: "Retention", icon: HeartPulse, group: "Hiring", blurb: "Where high attrition means pause & fix", primary: true },
  { path: "/action-center", label: "Action Center", icon: ListChecks, group: "Hiring", blurb: "Where to hire, pause, investigate today", primary: true },

  // Secondary — under "More".
  { path: "/start-readiness", label: "Start Readiness", icon: CalendarClock, group: "Plan", blurb: "Go-live risk on upcoming starts" },
  { path: "/stability", label: "Recommendation Stability", icon: Waves, group: "Govern", blurb: "Anti-flapping: stable actions, not weekly swings" },
  { path: "/leadership-decisions", label: "Leadership Decisions", icon: ShieldCheck, group: "Govern", blurb: "Exceptions & risk ownership" },
  { path: "/demand-handoffs", label: "Demand Handoffs", icon: Megaphone, group: "Govern", blurb: "Create demand before hiring" },
  { path: "/scenario-lab", label: "Scenario Lab", icon: FlaskConical, group: "Plan", blurb: "Model hiring strategies" },
  { path: "/data-health", label: "Data Health", icon: Activity, group: "Configure", blurb: "Completeness & confidence" },
  { path: "/operating-rules", label: "Operating Rules", icon: SlidersHorizontal, group: "Configure", blurb: "Thresholds & policy" },
];

export const PRIMARY = NAV.filter((n) => n.primary);
export const SECONDARY = NAV.filter((n) => !n.primary);
export const MORE_GROUPS = ["Plan", "Govern", "Configure"];
