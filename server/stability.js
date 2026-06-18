/**
 * Recommendation stability engine — PRD §15.10 / §15.12.
 *
 * The legacy tool's central failure was OSCILLATION: it would recommend opening
 * requisitions one cycle and closing them the next. This module is the governed fix.
 * It takes a market's per-cycle readiness signal (which naively flaps across
 * thresholds) and produces a STABLE committed action via four controls:
 *
 *   1. Hysteresis  — different thresholds to enter vs. leave a rung (dead-band).
 *   2. Persistence — a new target must hold N consecutive cycles before it commits.
 *   3. Cooldown    — after a material change, reversals are held for a cooldown window.
 *   4. Action ladder — moves toward less hiring descend ONE rung per cycle; the engine
 *                      never jumps straight from "Open" to "Review for Closure".
 *
 * Pure functions only — no DB, no time-of-day. Deterministic and unit-tested.
 */

// Action ladder, most-hiring (0) → least-hiring (4). Closure is the bottom rung and is
// never automatic — it is only ever a *review* recommendation for a human (PRD §14.2).
export const ACTION_LADDER = [
  "Keep Open - Priority",
  "Keep Open - Balanced",
  "Pipeline Only",
  "Pause Sourcing",
  "Review for Closure",
];

export const DEFAULT_STABILITY = {
  // Score band centers for each rung; hysteresis adds a dead-band so a market near a
  // boundary doesn't toggle. Higher readiness score → higher (more-hiring) rung.
  bands: [70, 55, 40, 25], // ≥70→rung0, ≥55→1, ≥40→2, ≥25→3, else→4
  deadband: 5,             // must cross a boundary by this margin to change rung
  persistenceCycles: 2,    // a new target must hold this many cycles to commit
  cooldownDays: 14,        // hold reversals for this long after a material change
  cycleDays: 7,            // spacing between refresh cycles
};

// Raw rung a score implies, with a hysteresis dead-band around the current committed rung
// so small wobbles near a threshold don't flip the rung.
export function rungFromScore(score, committedRung, rules = DEFAULT_STABILITY) {
  const { bands, deadband } = rules;
  let target = bands.length; // worst rung by default
  for (let i = 0; i < bands.length; i++) {
    if (score >= bands[i]) { target = i; break; }
  }
  if (committedRung == null) return target;
  // Dead-band: only move if the score is clearly past the boundary we'd cross.
  if (target < committedRung) {
    // moving up (more hiring) — require score to clear the upper band by the margin
    const need = bands[target] + deadband;
    if (score < need) return committedRung;
  } else if (target > committedRung) {
    // moving down (less hiring) — require score to fall under the lower band by the margin
    const need = (bands[committedRung] ?? 0) - deadband;
    if (score > need) return committedRung;
  }
  return target;
}

/**
 * Run the stability state machine across an ordered series of cycles (oldest → newest).
 * Each cycle is { date: 'YYYY-MM-DD', score: number }. Returns the committed action and
 * the governance state (pending change, cooldown, why-changed, reversal counts).
 */
export function stabilize(series, rules = DEFAULT_STABILITY) {
  const naive = []; // rung the naive (legacy) engine would show each cycle
  let committed = null;
  let lastChange = null;        // date of last committed change
  let pendingTarget = null, pendingCount = 0;
  let rawReversals = 0, committedReversals = 0;
  let whyChanged = null;
  let prevNaive = null;

  for (const { date, score } of series) {
    const naiveRung = rungFromScore(score, null, rules);
    naive.push(naiveRung);
    if (prevNaive != null && naiveRung !== prevNaive) rawReversals++;
    prevNaive = naiveRung;

    if (committed == null) { committed = naiveRung; lastChange = date; continue; }

    const target = rungFromScore(score, committed, rules);
    if (target === committed) { pendingTarget = null; pendingCount = 0; continue; }

    // Ladder: step exactly one rung toward the target.
    const step = target > committed ? 1 : -1;
    const desired = committed + step;

    if (pendingTarget === desired) pendingCount++;
    else { pendingTarget = desired; pendingCount = 1; }

    const daysSinceChange = lastChange ? cycleDaysBetween(lastChange, date) : Infinity;
    const inCooldown = daysSinceChange < rules.cooldownDays;
    const persisted = pendingCount >= rules.persistenceCycles;

    if (persisted && !inCooldown) {
      const prev = committed;
      committed = desired;
      committedReversals++;
      lastChange = date;
      whyChanged = `${ACTION_LADDER[prev]} → ${ACTION_LADDER[committed]} (readiness ${Math.round(score)}, held ${pendingCount} cycles)`;
      pendingTarget = null; pendingCount = 0;
    }
  }

  const last = series[series.length - 1];
  const cooldownUntil = lastChange ? addDays(lastChange, rules.cooldownDays) : null;
  const cooldownActive = last && lastChange ? cycleDaysBetween(lastChange, last.date) < rules.cooldownDays : false;

  return {
    committed_rung: committed,
    committed_action: ACTION_LADDER[committed],
    raw_rung: naive[naive.length - 1],
    raw_action: ACTION_LADDER[naive[naive.length - 1]],
    pending: pendingTarget != null
      ? { to_action: ACTION_LADDER[pendingTarget], count: pendingCount, need: rules.persistenceCycles }
      : null,
    cooldown_until: cooldownActive ? cooldownUntil : null,
    why_changed: whyChanged,
    raw_reversals: rawReversals,
    committed_reversals: committedReversals,
    state: pendingTarget != null ? "Pending" : cooldownActive ? "Cooldown" : "Stable",
  };
}

// Deterministic per-market readiness history. The legacy signal wobbles week to week;
// this reproduces that so the stability engine has something real to smooth. The newest
// cycle anchors to the market's actual current readiness score.
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function simulateSeries(readinessScore, seed, today, cycles = 6, rules = DEFAULT_STABILITY) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < cycles; i++) {
    const date = addDays(today, -(cycles - 1 - i) * rules.cycleDays);
    const wiggle = (r() - 0.5) * 26; // ±13 points of week-to-week noise
    const score = i === cycles - 1 ? readinessScore : Math.max(0, Math.min(100, Math.round(readinessScore + wiggle)));
    out.push({ date, score });
  }
  return out;
}

/** Convenience: simulate a market's recent cycles and return the stabilized result. */
export function marketStability(readinessScore, seed, today, rules = DEFAULT_STABILITY) {
  const series = simulateSeries(readinessScore, seed, today, 6, rules);
  return { ...stabilize(series, rules), series: series.map((s) => s.score) };
}

function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function cycleDaysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
}
