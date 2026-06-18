import { test } from "node:test";
import assert from "node:assert/strict";
import { areaSignals, seasonalForecast } from "./areaSignals.js";
import { retentionSummary } from "./pipeline.js";
import { priorityExplain } from "./reqplanner.js";

const TODAY = new Date("2026-06-18T00:00:00Z");
const area = { id: 7, code: "4755_A", name: "Sample", zip: "30303", region: "South" };
const metricsT2 = [{ skill_family: "T2", d2c_rt: 6, other_rt: 4, d2c_vol: 100, other_vol: 100, in_training: 4, open_positions: 2 }];
const metricsHVAC = [{ skill_family: "HVAC", d2c_rt: 5, other_rt: 0, d2c_vol: 30, other_vol: 0, in_training: 0, open_positions: 1 }];

test("areaSignals is deterministic per area", () => {
  const a = areaSignals(area, metricsT2, TODAY);
  const b = areaSignals(area, metricsT2, TODAY);
  assert.equal(a.grad_rate, b.grad_rate);
  assert.equal(a.territory, b.territory);
  assert.equal(a.license_risk, b.license_risk);
});

test("b2b_share = other_vol / total_vol", () => {
  const s = areaSignals(area, metricsT2, TODAY);
  assert.equal(s.total_vol, 200);
  assert.equal(s.b2b_share, 50); // 100 / 200
});

test("effective_pipeline never exceeds trainee count", () => {
  const s = areaSignals(area, metricsT2, TODAY);
  assert.ok(s.effective_pipeline <= s.trainees);
  assert.ok(s.grad_rate > 0 && s.grad_rate <= 1);
});

test("license_risk only set when HVAC is present", () => {
  assert.equal(areaSignals(area, metricsT2, TODAY).license_risk, null);
  assert.notEqual(areaSignals({ ...area, id: 9 }, metricsHVAC, TODAY).license_risk, null);
});

test("seasonalForecast returns a projected volume", () => {
  const f = seasonalForecast("HVAC", 100, TODAY);
  assert.equal(typeof f.projected, "number");
  assert.equal(f.delta, f.projected - 100);
});

test("priorityExplain names the factors that drove the verdict", () => {
  const surge = { forecast: { trend: "Surge ahead", pct: 8 }, license_risk: "High", territory: "Rural" };
  const crit = priorityExplain("Critical", 4, 14.2, surge);
  assert.match(crit.reason, /^Critical/);
  assert.ok(crit.factors.some((f) => f.includes("reqs to open")));
  assert.ok(crit.factors.some((f) => f.includes("run-time high")));
  const lim = priorityExplain("Limited", 0, 2, { forecast: { trend: "Cooling", pct: -8 } });
  assert.match(lim.reason, /Limited/);
});

test("retentionSummary computes tenure and 90-day trajectory", () => {
  const day = (n) => new Date(TODAY.getTime() + n * 86400000).toISOString().slice(0, 10);
  const techs = [
    { market: "Atlanta", start_date: day(-200), exit_date: null, experience_level: "Experienced" },
    { market: "Atlanta", start_date: day(-30), exit_date: null, experience_level: "Green" },
  ];
  const s = retentionSummary(techs, TODAY);
  assert.equal(s.avg_tenure_days, 115);   // (200 + 30) / 2
  assert.equal(s.headcount_trend, 1);     // the -30d hire wasn't active 90 days ago
  assert.equal(s.byMarket[0].avg_tenure_days, 115);
});
