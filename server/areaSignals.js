/**
 * Area-level hiring/pause signals — the "is this really a hire, or pause/fix?" layer
 * that sits on top of the raw req math. Pure functions over a planning area + its
 * per-family demand rows. Everything stays inside the product's mandate: where to
 * hire, where to pause. No recruiter, source, or cost logic lives here.
 *
 * Signals that need a dimension the seed DB doesn't store (licensing, territory,
 * trainee graduation, prior-year) are derived DETERMINISTICALLY from the area's own
 * identity, so they are stable per area across reloads and reseeds — sample data, in
 * keeping with the rest of this seeded demo, never a random number that moves.
 */

// Seasonal demand curves (12 monthly factors, Jan→Dec). Field service is seasonal:
// HVAC spikes in summer + deep winter; appliance/refrigeration (HA/T2) surges after
// the holidays and in summer; general T1 is comparatively flat.
export const SEASONAL = {
  HVAC: [0.85, 0.82, 0.86, 0.95, 1.08, 1.22, 1.30, 1.24, 1.02, 0.9, 0.96, 1.12],
  T2:   [1.16, 1.10, 1.00, 0.95, 1.00, 1.08, 1.12, 1.06, 0.96, 0.95, 1.06, 1.16],
  T1:   [1.00, 1.00, 1.00, 1.02, 1.05, 1.06, 1.06, 1.05, 1.00, 1.00, 1.00, 1.02],
  "1099":[1.05, 1.02, 1.00, 1.00, 1.02, 1.05, 1.06, 1.04, 1.00, 1.00, 1.02, 1.05],
};

// Stable 0..1 pseudo-random stream from an integer seed (same LCG the seeders use).
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function seedOf(area) {
  const z = parseInt(String(area.zip || "0").replace(/\D/g, ""), 10) || 0;
  return ((area.id || 0) * 2654435761 + z) >>> 0;
}

/** Forward demand projection: how next month's seasonality moves this volume. */
export function seasonalForecast(family, totalVol, today = new Date()) {
  const curve = SEASONAL[family] || SEASONAL.T1;
  const m = today.getMonth();
  const next = (m + 1) % 12;                       // ~4–6 weeks out
  const factor = curve[next] / curve[m];
  const projected = Math.round(totalVol * factor);
  const delta = projected - totalVol;
  const pct = totalVol ? Math.round((delta / totalVol) * 100) : 0;
  return { projected, delta, pct };
}

/**
 * Compute the full signal bundle for one planning area.
 *  - area:    planning_areas row (id, code, name, zip, region)
 *  - metrics: that area's area_metrics rows (one per skill family)
 */
export function areaSignals(area, metrics, today = new Date()) {
  const r = rng(seedOf(area));
  const families = metrics.map((m) => m.skill_family);
  const totalVol = metrics.reduce((s, m) => s + (m.d2c_vol || 0) + (m.other_vol || 0), 0);
  const otherVol = metrics.reduce((s, m) => s + (m.other_vol || 0), 0);
  const trainees = metrics.reduce((s, m) => s + (m.in_training || 0), 0);
  const rts = metrics.flatMap((m) => [m.d2c_rt, m.other_rt].filter((v) => v != null && v > 0));
  const avgRT = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;

  // #6 / #7 — trainee yield + readiness. A seeded graduation rate turns a raw trainee
  // count into the supply you can actually bank on, and an ETA says when it lands.
  const gradRate = +(0.55 + r() * 0.35).toFixed(2);          // 55%–90%
  const effectivePipeline = Math.round(trainees * gradRate);
  const traineeEtaWeeks = trainees > 0 ? 2 + Math.floor(r() * 9) : null; // 2–10 weeks

  // #11 — forward (seasonal) demand. Sum each family's own seasonal move.
  let projected = 0;
  for (const m of metrics) {
    const fv = (m.d2c_vol || 0) + (m.other_vol || 0);
    projected += seasonalForecast(m.skill_family, fv, today).projected;
  }
  const fDelta = projected - totalVol;
  const fPct = totalVol ? Math.round((fDelta / totalVol) * 100) : 0;
  const forecast = {
    current_vol: totalVol, projected_vol: projected, delta: fDelta, pct: fPct,
    trend: fPct >= 6 ? "Surge ahead" : fPct <= -6 ? "Cooling" : "Steady",
  };

  // #9 — service-territory density. A rural area's tech can't physically cover the
  // same dispatch count as an urban one, so "understaffed" may be structural.
  const tRoll = r();
  const territory = tRoll < 0.3 ? "Urban" : tRoll < 0.72 ? "Suburban" : "Rural";

  // #18 — licensing risk (HVAC only). Trainees who can't be licensed can't deploy.
  const hasHVAC = families.includes("HVAC");
  const lRoll = r();
  const license_risk = hasHVAC ? (lRoll < 0.62 ? "Low" : lRoll < 0.86 ? "Medium" : "High") : null;

  // #19 — prior-year context for the busiest signal (run-time). Absolute RT in
  // isolation hides whether things are getting better or worse.
  const rtLy = +(avgRT * (0.72 + r() * 0.5)).toFixed(1);     // ±~ last-year value
  const yoy = { rt_now: +avgRT.toFixed(1), rt_ly: rtLy, dir: avgRT > rtLy ? "up" : avgRT < rtLy ? "down" : "flat" };

  // #16 — B2B / Other share of HA (T2) volume, already in the data via other_vol.
  const b2b_share = totalVol ? Math.round((otherVol / totalVol) * 100) : 0;

  return {
    total_vol: totalVol, trainees, grad_rate: gradRate, effective_pipeline: effectivePipeline,
    trainee_eta_weeks: traineeEtaWeeks, forecast, territory, license_risk, yoy, b2b_share,
  };
}

/** Roll area signals into report-level totals for the Req Planner header. */
export function signalTotals(rowsWithSignals) {
  const t = { effective_pipeline: 0, trainees: 0, surge_areas: 0, cooling_areas: 0, license_risk_areas: 0, rural_areas: 0 };
  for (const row of rowsWithSignals) {
    const s = row.signals;
    if (!s) continue;
    t.effective_pipeline += s.effective_pipeline;
    t.trainees += s.trainees;
    if (s.forecast.trend === "Surge ahead") t.surge_areas++;
    if (s.forecast.trend === "Cooling") t.cooling_areas++;
    if (s.license_risk === "High" || s.license_risk === "Medium") t.license_risk_areas++;
    if (s.territory === "Rural") t.rural_areas++;
  }
  return t;
}
