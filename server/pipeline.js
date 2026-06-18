/**
 * Technician retention engine — pure functions over the technician roster. Retention is a
 * hiring-decision input: a market with high attrition is a "pause and fix" signal, not a
 * "hire more" one. No candidate / source / recruiter logic lives here.
 */

function daysSince(iso, today = new Date()) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.round((today - d) / 86400000);
}

function tally(arr) {
  const m = {};
  for (const x of arr) m[x] = (m[x] || 0) + 1;
  return Object.entries(m).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

// Headcount active as of a point in time, from real start/exit dates.
function activeAsOf(list, when) {
  return list.filter((t) => {
    const s = new Date(t.start_date);
    if (isNaN(s.getTime()) || s > when) return false;
    if (!t.exit_date) return true;
    const e = new Date(t.exit_date);
    return isNaN(e.getTime()) || e > when;
  }).length;
}

/** Technician retention / attrition summary. */
export function retentionSummary(technicians, today = new Date()) {
  const active = technicians.filter((t) => !t.exit_date);
  const exited = technicians.filter((t) => t.exit_date);
  const recentExits = exited.filter((t) => (daysSince(t.exit_date, today) ?? 999) <= 90);

  const tenure = (t) => daysSince(t.start_date, t.exit_date ? new Date(t.exit_date) : today) ?? 0;
  const early = { d30: 0, d60: 0, d90: 0 };
  for (const t of exited) { const d = tenure(t); if (d <= 30) early.d30++; if (d <= 60) early.d60++; if (d <= 90) early.d90++; }

  const headcount = active.length + recentExits.length;
  const attritionRate = headcount ? Math.round((recentExits.length / headcount) * 100) : 0;

  // #5 — average tenure of the ACTIVE workforce (months). A green bench reschedules
  // and cancels more for skill reasons, not headcount ones.
  const avgTenureDays = active.length ? Math.round(active.reduce((s, t) => s + tenure(t), 0) / active.length) : 0;
  // #15 — net headcount trajectory over the last 90 days (real start/exit dates).
  const ago = new Date(today); ago.setDate(ago.getDate() - 90);
  const headcountTrend = active.length - activeAsOf(technicians, ago);

  const markets = [...new Set(technicians.map((t) => t.market))];
  const byMarket = markets.map((mk) => {
    const inMk = technicians.filter((t) => t.market === mk);
    const a = active.filter((t) => t.market === mk).length;
    const ex = recentExits.filter((t) => t.market === mk).length;
    const hc = a + ex;
    const earlyEx = exited.filter((t) => t.market === mk && tenure(t) <= 90 && (daysSince(t.exit_date, today) ?? 999) <= 180).length;
    const activeMk = active.filter((t) => t.market === mk);
    const avgTenure = activeMk.length ? Math.round(activeMk.reduce((s, t) => s + tenure(t), 0) / activeMk.length) : 0;
    return {
      market: mk, active: a, exits_90d: ex, attrition_rate: hc ? Math.round((ex / hc) * 100) : 0,
      early_attrition: earlyEx, avg_tenure_days: avgTenure, headcount_trend: a - activeAsOf(inMk, ago),
    };
  }).sort((x, y) => y.attrition_rate - x.attrition_rate || y.exits_90d - x.exits_90d);

  return {
    active: active.length, exited_90d: recentExits.length, attrition_rate: attritionRate,
    avg_tenure_days: avgTenureDays, headcount_trend: headcountTrend,
    early, byReason: tally(exited.map((t) => t.exit_reason || "Unknown")),
    byType: tally(exited.map((t) => t.exit_type || "Unknown")),
    bySource: tally(exited.map((t) => t.hire_source || "Unknown")),
    byMarket,
    greenShare: active.length ? Math.round((active.filter((t) => t.experience_level === "Green").length / active.length) * 100) : 0,
  };
}
