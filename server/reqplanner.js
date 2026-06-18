/**
 * Requisition-planning engine (HirePower-style). Pure functions over per-area, per-skill
 * demand + capacity. For each (area, skill) it recommends how many reqs to OPEN (demand
 * exceeds the hiring pipeline) or CLOSE (over-resourced / soft demand), and rolls areas up
 * to a Critical / Moderate / Limited priority.
 *
 * Inputs per metric row: d2c_rt, other_rt (run-time / utilization indices, higher = busier),
 * d2c_vol, other_vol (job volume by channel), in_training, open_positions.
 */

import { areaSignals, signalTotals } from "./areaSignals.js";

export const VOL_PER_TECH = 70; // job volume one tech absorbs per planning period

export function computeAreaReq(m) {
  const totalVol = (m.d2c_vol || 0) + (m.other_vol || 0);
  const rts = [m.d2c_rt, m.other_rt].filter((v) => v != null && v > 0);
  const avgRT = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;
  const pipeline = (m.open_positions || 0) + (m.in_training || 0); // already being addressed
  // Heads needed = volume coverage, bumped when utilization (run-time) runs hot.
  const needed = Math.round(totalVol / VOL_PER_TECH) + (avgRT > 12 ? 2 : avgRT > 8 ? 1 : 0);
  const reqs_to_open = Math.max(0, needed - pipeline);
  let reqs_to_close = 0;
  if (totalVol < 40 || avgRT < 3) reqs_to_close = m.open_positions || 0;          // demand too soft to justify open positions
  else reqs_to_close = Math.max(0, (m.open_positions || 0) - needed);              // trim positions beyond what's needed
  return { needed, reqs_to_open, reqs_to_close, avg_rt: +avgRT.toFixed(2), total_vol: totalVol };
}

export function areaPriority(reqOpenSum, maxRT) {
  if (reqOpenSum >= 3 || (reqOpenSum >= 1 && maxRT > 12)) return "Critical";
  if (reqOpenSum >= 1) return "Moderate";
  return "Limited";
}

/** Build the full Req Planner report from planning_areas + area_metrics rows. */
export function reqPlannerReport(areas, metrics, today = new Date()) {
  const byArea = {};
  for (const m of metrics) (byArea[m.area_id] = byArea[m.area_id] || []).push(m);
  const families = [...new Set(metrics.map((m) => m.skill_family))];
  const order = ["T2", "HVAC", "T1", "1099"];
  families.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  const totals = Object.fromEntries(families.map((f) => [f, { open: 0, close: 0 }]));
  const rows = areas.map((a) => {
    const ms = byArea[a.id] || [];
    const byFamily = {};
    let openSum = 0, maxRT = 0;
    for (const m of ms) {
      const c = computeAreaReq(m);
      byFamily[m.skill_family] = { ...m, ...c };
      openSum += c.reqs_to_open;
      maxRT = Math.max(maxRT, c.avg_rt);
      totals[m.skill_family].open += c.reqs_to_open;
      totals[m.skill_family].close += c.reqs_to_close;
    }
    return {
      id: a.id, code: a.code, name: a.name, zip: a.zip, region: a.region, is_union_pr: a.is_union_pr,
      priority: areaPriority(openSum, maxRT), reqs_open_total: openSum, byFamily,
      signals: areaSignals(a, ms, today),
    };
  });

  const total_to_open = Object.values(totals).reduce((s, t) => s + t.open, 0);
  const total_to_close = Object.values(totals).reduce((s, t) => s + t.close, 0);
  const summary = {
    areas: areas.length,
    need_reqs: rows.filter((r) => r.reqs_open_total > 0).length,
    critical: rows.filter((r) => r.priority === "Critical").length,
    moderate: rows.filter((r) => r.priority === "Moderate").length,
    limited: rows.filter((r) => r.priority === "Limited").length,
    union_pr: rows.filter((r) => r.is_union_pr).length,
  };
  return { families, totals, total_to_open, total_to_close, summary, rows, signal_totals: signalTotals(rows) };
}
