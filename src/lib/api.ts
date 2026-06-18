import type { DemandSupplyReport } from "./types";

const BASE = "/api";

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch {}
    throw new Error(msg);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text() as unknown as T;
}

export const api = {
  markets: () => req<any[]>("/markets"),
  market: (id: number) => req<any>(`/markets/${id}`),
  createMarket: (body: any) => req<any>("/markets", { method: "POST", body: JSON.stringify(body) }),
  updateMarket: (id: number, body: any) => req<any>(`/markets/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteMarket: (id: number) => req<any>(`/markets/${id}`, { method: "DELETE" }),

  summary: () => req<any>("/summary"),
  demandSupply: () => req<DemandSupplyReport>("/demand-supply"),
  reqPlanner: () => req<any>("/req-planner"),
  retention: () => req<any>("/retention"),
  actionCenter: () => req<any>("/action-center"),
  startReadiness: () => req<any>("/start-readiness"),
  dataHealth: () => req<any[]>("/data-health"),
  changes: () => req<any[]>("/changes"),
  audit: (limit = 100) => req<any[]>(`/audit?limit=${limit}`),
  leadershipSummary: () => req<{ text: string }>("/leadership-summary"),

  handoffs: () => req<any[]>("/handoffs"),
  createHandoff: (body: any) => req<any>("/handoffs", { method: "POST", body: JSON.stringify(body) }),
  updateHandoff: (id: number, body: any) => req<any>(`/handoffs/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteHandoff: (id: number) => req<any>(`/handoffs/${id}`, { method: "DELETE" }),

  exceptions: () => req<any[]>("/leadership-exceptions"),
  createException: (body: any) => req<any>("/leadership-exceptions", { method: "POST", body: JSON.stringify(body) }),
  updateException: (id: number, body: any) => req<any>(`/leadership-exceptions/${id}`, { method: "PUT", body: JSON.stringify(body) }),

  decisions: () => req<any[]>("/decisions"),
  createDecision: (body: any) => req<any>("/decisions", { method: "POST", body: JSON.stringify(body) }),

  rules: () => req<any[]>("/rules"),
  updateRules: (rules: any[]) => req<any[]>("/rules", { method: "PUT", body: JSON.stringify({ rules }) }),
  resetRules: () => req<any[]>("/rules/reset", { method: "POST" }),

  runScenario: (scenario: string, params: any) =>
    req<any>("/scenarios/run", { method: "POST", body: JSON.stringify({ scenario, params }) }),

  importMarkets: (csv: string) => req<any>("/import/markets", { method: "POST", body: JSON.stringify({ csv }) }),
};

export function downloadUrl(path: string) {
  return BASE + path;
}
