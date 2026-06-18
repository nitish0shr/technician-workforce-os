import { test } from "node:test";
import assert from "node:assert/strict";
import { rungFromScore, stabilize, ACTION_LADDER } from "./stability.js";

// Six weekly cycles ending 2026-06-18 (oldest → newest), matching the default cycleDays.
const DATES = ["2026-05-14", "2026-05-21", "2026-05-28", "2026-06-04", "2026-06-11", "2026-06-18"];
const mk = (scores) => scores.map((score, i) => ({ date: DATES[i], score }));

test("rungFromScore maps readiness to the ladder", () => {
  assert.equal(rungFromScore(75, null), 0); // Keep Open - Priority
  assert.equal(rungFromScore(60, null), 1);
  assert.equal(rungFromScore(45, null), 2);
  assert.equal(rungFromScore(30, null), 3);
  assert.equal(rungFromScore(10, null), 4); // Review for Closure
});

test("hysteresis holds a rung inside the dead-band", () => {
  assert.equal(rungFromScore(67, 0), 0); // within 5 of the 70 boundary → stay
  assert.equal(rungFromScore(63, 0), 1); // clearly past it → move
});

test("flapping signal is absorbed — committed action never reverses", () => {
  const r = stabilize(mk([80, 20, 80, 20, 80, 20]));
  assert.ok(r.raw_reversals >= 4, "naive engine flaps");
  assert.equal(r.committed_reversals, 0, "stable engine does not");
  assert.equal(r.committed_action, "Keep Open - Priority");
});

test("a sustained decline steps DOWN the ladder one rung at a time, never jumps to closure", () => {
  const r = stabilize(mk([80, 30, 30, 30, 30, 30]));
  assert.equal(r.raw_action, "Pause Sourcing", "naive jumps straight down");
  assert.equal(r.committed_rung, 2, "stable engine only reached Pipeline Only");
  assert.equal(r.committed_reversals, 2, "moved 0→1→2, one rung per commit");
  assert.ok(r.pending && r.pending.to_action === "Pause Sourcing", "next step is pending, not taken");
  assert.notEqual(r.committed_action, "Review for Closure"); // closure is never auto-reached
});

test("a steady-high market stays Stable", () => {
  const r = stabilize(mk([80, 80, 80, 80, 80, 80]));
  assert.equal(r.committed_reversals, 0);
  assert.equal(r.state, "Stable");
  assert.equal(r.committed_action, ACTION_LADDER[0]);
});
