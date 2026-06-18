/**
 * Scoring-engine regression suite.
 *
 * The recommendation engine is the product's core IP, so its behaviour is pinned here.
 * Runs on the built-in Node test runner (no toolchain): `node --test server/`.
 * Every case below documents an executive-facing guarantee — that the numbers are
 * internally consistent, that two surfaces never contradict each other, and that
 * missing or stale data is never dressed up as confident, healthy signal.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRecommendation, confidenceScore, rulesToMap, DEFAULT_RULES } from "./scoring.js";

const RULES = rulesToMap(DEFAULT_RULES);
const D = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };

// A complete, fresh, healthy market. Tests override only what they exercise.
const base = () => ({
  id: 1, region: "West", planning_area: "Metro", market: "Testville", skill_type: "HVAC",
  current_headcount: 8, target_headcount: 14, pending_offers: 0, pending_starts: 1,
  next_start_date: D(15), open_reqs: 2, actual_work_volume: 72, forecasted_demand: 70,
  forward_capacity: 68, mentor_capacity: 3, training_capacity: 6, attrition_90_days: 8,
  recruiter_pipeline_count: 4, market_priority: "High", is_union_market: 0, is_focus_market: 0,
  leadership_exception: 0, exception_reason: "", owner: "Test Owner", skill_match: 72,
  previous_readiness_status: null, last_updated: D(-1),
});
const rec = (over) => computeRecommendation({ ...base(), ...over }, RULES);

test("clean strong market is Ready to Hire and Understaffed (demand exceeds supply)", () => {
  const d = rec({ is_focus_market: 1, mentor_capacity: 3, training_capacity: 6, pending_starts: 1 });
  assert.equal(d.readiness_status, "Ready to Hire");
  assert.equal(d.risk_level, "Low");
  assert.equal(d.go_live_status, "Ready");
  assert.equal(d.demand_supply_state, "Understaffed");
  assert.ok(d.contributions.readiness.length > 0, "exposes readiness provenance");
});

test("GUARDRAIL: a rosy forecast over no real work never reads as Ready to Hire", () => {
  // work=10 (no jobs on the board) but forecast=95. The old max() logic called this
  // High demand and shipped "Ready to Hire" alongside "Go-Live Blocked".
  const d = rec({ actual_work_volume: 10, forecasted_demand: 95, forward_capacity: 12, next_start_date: D(3) });
  assert.equal(d.demand_conflict, true, "flags the conflicting signal");
  assert.notEqual(d.readiness_status, "Ready to Hire");
  // The core invariant: the two surfaces can never contradict each other.
  assert.ok(!(d.readiness_status === "Ready to Hire" && d.go_live_status === "Blocked"),
    "Ready to Hire and Go-Live Blocked must never co-occur");
});

test("stale-but-complete data cannot read as high confidence", () => {
  const fresh = confidenceScore({ ...base(), last_updated: D(-1) });
  const stale = confidenceScore({ ...base(), last_updated: D(-200) });
  assert.ok(fresh >= 95, `fresh complete record is confident (${fresh})`);
  assert.ok(stale < 60, `200-day-old record is no longer high-confidence (${stale})`);
});

test("missing demand data raises risk instead of defaulting to 'safe'", () => {
  // No work volume and no forecast at all. The old code defaulted work to 55 (=safe).
  const d = rec({ actual_work_volume: null, forecasted_demand: null });
  assert.ok(d.risk_drivers.includes("no demand signal"), "missing demand signal is itself a risk");
});

test("an unknown skill match is never invented as a neutral score", () => {
  const known = rec({ skill_match: 60 });
  const unknown = rec({ skill_match: null });
  assert.notEqual(known.market_readiness_score, unknown.market_readiness_score);
  assert.ok(unknown.market_readiness_score < known.market_readiness_score,
    "missing skill match lowers readiness rather than fabricating points");
});

test("Data Incomplete markets are flagged reference-only", () => {
  const d = rec({ target_headcount: null, mentor_capacity: null, forward_capacity: null, forecasted_demand: null });
  assert.equal(d.readiness_status, "Data Incomplete");
  assert.equal(d.reference_only, true);
});

test("a gap with soft demand is Demand-soft, not a reason to add supply", () => {
  const d = rec({ actual_work_volume: 22, forecasted_demand: 26, forward_capacity: 24, pending_starts: 1, target_headcount: 14, current_headcount: 8 });
  assert.equal(d.demand_status, "Low");
  assert.equal(d.demand_supply_state, "Demand-soft");
});

test("demand with a gap but no capacity to absorb is Capacity-blocked", () => {
  const d = rec({ actual_work_volume: 80, forecasted_demand: 78, forward_capacity: 74, mentor_capacity: 0, training_capacity: 0, pending_starts: 2, target_headcount: 15, current_headcount: 9 });
  assert.equal(d.demand_supply_state, "Capacity-blocked");
});

test("at or above target reads as Supply-met", () => {
  const d = rec({ target_headcount: 10, current_headcount: 12, pending_starts: 0 });
  assert.equal(d.demand_supply_state, "Supply-met");
});

test("a top-priority market that is also At Risk is flagged as a conflict", () => {
  // Phoenix pattern: high demand + zero mentors + req overload → high priority AND at risk.
  const d = rec({ actual_work_volume: 84, forecasted_demand: 80, forward_capacity: 78, mentor_capacity: 0, training_capacity: 2, pending_starts: 3, open_reqs: 6, attrition_90_days: 16, target_headcount: 15, current_headcount: 9 });
  assert.equal(d.readiness_status, "At Risk");
  assert.ok(d.priority_score >= 65, `still ranks high on priority (${d.priority_score})`);
  assert.equal(d.status_conflict, true);
});

test("more mentors never increases risk (monotonicity sanity check)", () => {
  const thin = rec({ mentor_capacity: 0, pending_starts: 2 }).risk_score;
  const deep = rec({ mentor_capacity: 4, pending_starts: 2 }).risk_score;
  assert.ok(deep <= thin, `deeper mentor bench should not raise risk (${deep} vs ${thin})`);
});

