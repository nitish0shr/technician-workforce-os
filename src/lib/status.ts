// Centralised colour + label system so every status renders identically.

const C = {
  emerald: "text-emerald-700 border-emerald-200 bg-emerald-50",
  sky: "text-sky-700 border-sky-200 bg-sky-50",
  amber: "text-amber-700 border-amber-200 bg-amber-50",
  violet: "text-violet-700 border-violet-200 bg-violet-50",
  cyan: "text-cyan-700 border-cyan-200 bg-cyan-50",
  rose: "text-rose-700 border-rose-200 bg-rose-50",
  fuchsia: "text-fuchsia-700 border-fuchsia-200 bg-fuchsia-50",
  slate: "text-slate-600 border-slate-200 bg-slate-100",
  orange: "text-orange-700 border-orange-200 bg-orange-50",
  indigo: "text-indigo-700 border-indigo-200 bg-indigo-50",
};

export const STATUS_COLOR: Record<string, string> = {
  "Ready to Hire": C.emerald,
  "Pipeline Only": C.sky,
  "Stagger Starts": C.amber,
  "Demand First": C.violet,
  "Training First": C.cyan,
  "At Risk": C.rose,
  "Leadership Exception": C.fuchsia,
  "Data Incomplete": C.slate,
  Hold: C.slate,
};

// A deliberately tight semantic dot palette: green = good, amber = caution,
// red = danger, blue = building/info, violet = governance, zinc = neutral.
// Pills are neutral; the dot carries the meaning (Linear/Stripe-style restraint).
export const STATUS_DOT: Record<string, string> = {
  "Ready to Hire": "bg-emerald-500",
  "Pipeline Only": "bg-blue-500",
  "Stagger Starts": "bg-amber-500",
  "Demand First": "bg-amber-500",
  "Training First": "bg-amber-500",
  "At Risk": "bg-red-500",
  "Leadership Exception": "bg-violet-500",
  "Data Incomplete": "bg-zinc-400",
  Hold: "bg-zinc-400",
};

export const riskDot = (l: string) => (l === "Low" ? "bg-emerald-500" : l === "Medium" ? "bg-amber-500" : l === "High" ? "bg-red-500" : "bg-red-600");
export const goLiveDot = (s: string) => (s === "Ready" ? "bg-emerald-500" : s === "Watch" ? "bg-amber-500" : s === "Blocked" ? "bg-red-500" : "bg-zinc-400");
export const severityDot = (s: string) => (s === "Low" ? "bg-blue-500" : s === "Medium" ? "bg-amber-500" : s === "High" ? "bg-red-500" : s === "Critical" ? "bg-red-600" : "bg-zinc-400");
export const demandDot = (s: string) => (s === "High" ? "bg-emerald-500" : s === "Medium" ? "bg-amber-500" : s === "Low" ? "bg-red-500" : "bg-zinc-400");
export const trainingDot = (s: string) => (s === "Ready" ? "bg-emerald-500" : s === "Limited" ? "bg-amber-500" : s === "Not Ready" ? "bg-red-500" : "bg-zinc-400");
export const modeDot = (m: string) => (m === "Aggressive" ? "bg-emerald-500" : m === "Exception" ? "bg-violet-500" : m === "Hold" ? "bg-zinc-400" : m === "Staggered" || m === "Demand-Led" || m === "Training-Led" ? "bg-amber-500" : "bg-blue-500");
export const handoffDot = (s: string) => (s === "Resolved" ? "bg-emerald-500" : s === "Missed" ? "bg-red-500" : s === "At Risk" ? "bg-amber-500" : s === "Sent" || s === "Accepted" || s === "In Progress" ? "bg-blue-500" : "bg-zinc-400");
export const exceptionDot = (s: string) => (s === "Approved" ? "bg-emerald-500" : s === "Denied" || s === "Withdrawn" ? "bg-red-500" : s === "Requested" ? "bg-amber-500" : "bg-blue-500");

export function riskColor(level: string) {
  return level === "Low" ? C.emerald : level === "Medium" ? C.amber : level === "High" ? C.orange : C.rose;
}

export function goLiveColor(status: string) {
  return status === "Ready" ? C.emerald : status === "Watch" ? C.amber : status === "Blocked" ? C.rose : C.slate;
}

export function modeColor(mode: string) {
  switch (mode) {
    case "Aggressive": return C.emerald;
    case "Balanced": return C.sky;
    case "Pipeline": return C.indigo;
    case "Staggered": return C.amber;
    case "Demand-Led": return C.violet;
    case "Training-Led": return C.cyan;
    case "Exception": return C.fuchsia;
    default: return C.slate;
  }
}

export function severityColor(sev: string) {
  return sev === "Low" ? C.sky : sev === "Medium" ? C.amber : sev === "High" ? C.orange : sev === "Critical" ? C.rose : C.slate;
}

export function handoffColor(status: string) {
  switch (status) {
    case "Resolved": return C.emerald;
    case "Accepted": case "In Progress": return C.sky;
    case "Sent": return C.indigo;
    case "Not Sent": return C.slate;
    case "At Risk": return C.orange;
    case "Missed": return C.rose;
    default: return C.slate;
  }
}

export function exceptionColor(status: string) {
  switch (status) {
    case "Approved": return C.emerald;
    case "Requested": return C.amber;
    case "Under Review": return C.sky;
    case "Denied": case "Withdrawn": return C.rose;
    default: return C.slate;
  }
}

export function demandColor(status: string) {
  return status === "High" ? C.emerald : status === "Medium" ? C.amber : status === "Low" ? C.rose : C.slate;
}

export function trainingColor(status: string) {
  return status === "Ready" ? C.emerald : status === "Limited" ? C.amber : status === "Not Ready" ? C.rose : C.slate;
}

export function scoreTone(score: number, invert = false) {
  const s = invert ? 100 - score : score;
  if (s >= 70) return "emerald";
  if (s >= 45) return "amber";
  return "rose";
}

export const HIRING_MODES = ["Aggressive", "Balanced", "Pipeline", "Staggered", "Demand-Led", "Training-Led", "Exception", "Hold"];
export const STATUSES = ["Ready to Hire", "Pipeline Only", "Stagger Starts", "Demand First", "Training First", "At Risk", "Leadership Exception", "Data Incomplete", "Hold"];
export const SKILLS = ["HVAC", "Appliance", "Refrigeration", "Tech 1", "Senior Tech"];
