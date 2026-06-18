/**
 * Technician Workforce OS — scoring engine.
 *
 * Market-level workforce planning ONLY. This engine never scores, ranks, or
 * rejects individual candidates. It evaluates where to hire, how aggressively,
 * whether the field can train/support, whether work will exist post-go-live,
 * who owns the risk, and what should happen next.
 *
 * All functions are pure: they take a market row + a rules map and return
 * derived values, so recommendations always reflect current data.
 */

export const DEFAULT_RULES = [
  { rule_name: "high_demand_threshold", rule_value: 70, category: "Demand", unit: "index 0-100", description: "Work-volume / demand index at or above which demand is High." },
  { rule_name: "medium_demand_threshold", rule_value: 45, category: "Demand", unit: "index 0-100", description: "Demand index at or above which demand is Medium (below = Low)." },
  { rule_name: "low_demand_threshold", rule_value: 30, category: "Demand", unit: "index 0-100", description: "Work volume below which a market is treated as having no real work for go-live." },
  { rule_name: "high_readiness_threshold", rule_value: 70, category: "Readiness", unit: "score 0-100", description: "Readiness score at or above which hiring can be Aggressive." },
  { rule_name: "medium_readiness_threshold", rule_value: 45, category: "Readiness", unit: "score 0-100", description: "Readiness score floor for Balanced hiring." },
  { rule_name: "high_risk_threshold", rule_value: 50, category: "Risk", unit: "score 0-100", description: "Risk score at or above which a market is flagged High / At Risk." },
  { rule_name: "critical_risk_threshold", rule_value: 75, category: "Risk", unit: "score 0-100", description: "Risk score at or above which a market is Critical." },
  { rule_name: "max_pending_starts_per_mentor", rule_value: 2, category: "Capacity", unit: "starts / mentor", description: "How many concurrent new starts one mentor can safely support." },
  { rule_name: "go_live_risk_window_days", rule_value: 7, category: "Go-Live", unit: "days", description: "Days before a start date inside which low work or no mentor blocks go-live." },
  { rule_name: "focus_market_boost", rule_value: 10, category: "Priority", unit: "points", description: "Readiness points added for designated focus markets." },
  { rule_name: "union_market_adjustment", rule_value: -5, category: "Priority", unit: "points", description: "Readiness adjustment applied to union markets for ramp friction." },
  { rule_name: "part_time_threshold", rule_value: 30, category: "Demand", unit: "index 0-100", description: "If forecast demand and work volume are both below this, recommend part-time over full-time." },
  { rule_name: "demand_conflict_spread", rule_value: 30, category: "Demand", unit: "index points", description: "If demand signals (work, forecast, capacity) disagree by more than this, the market is flagged as a conflicting signal and the optimistic reading is not trusted on its own." },
  { rule_name: "default_exception_review_days", rule_value: 30, category: "Governance", unit: "days", description: "Default number of days until a leadership exception must be reviewed." },
];

const REQUIRED_FIELDS = [
  "current_headcount",
  "target_headcount",
  "open_reqs",
  "pending_starts",
  "actual_work_volume",
  "forecasted_demand",
  "forward_capacity",
  "mentor_capacity",
  "training_capacity",
  "market_priority",
];

const has = (v) => v !== null && v !== undefined && v !== "";
const num = (v, fb = 0) => (has(v) ? Number(v) : fb);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function rulesToMap(rows) {
  const map = {};
  for (const r of rows) map[r.rule_name] = Number(r.rule_value);
  // backfill any missing rule with its default so the engine never breaks
  for (const d of DEFAULT_RULES) if (!(d.rule_name in map)) map[d.rule_name] = d.rule_value;
  return map;
}

function daysBetween(fromISO, toISO) {
  if (!fromISO || !toISO) return null;
  const a = new Date(fromISO);
  const b = new Date(toISO);
  return Math.round((b - a) / 86400000);
}

export function missingFields(m) {
  return REQUIRED_FIELDS.filter((f) => !has(m[f]));
}

export function staleFields(m, today = new Date()) {
  // a field set is "stale" if the record hasn't been touched in 30+ days
  if (!has(m.last_updated)) return ["last_updated"];
  const age = daysBetween(m.last_updated, today.toISOString());
  return age != null && age > 30 ? ["record (" + age + "d old)"] : [];
}

export function confidenceScore(m, today = new Date()) {
  const present = REQUIRED_FIELDS.filter((f) => has(m[f])).length;
  const completeness = (present / REQUIRED_FIELDS.length) * 100;
  let freshness;
  let age = null;
  if (!has(m.last_updated)) freshness = 35;
  else {
    age = daysBetween(m.last_updated, today.toISOString()) ?? 999;
    // Freshness keeps decaying — a record left untouched for months is not trustworthy,
    // no matter how complete it is.
    freshness =
      age <= 7 ? 100 : age <= 14 ? 85 : age <= 30 ? 70 : age <= 60 ? 50 :
      age <= 120 ? 32 : age <= 240 ? 18 : 8;
  }
  let score = Math.round(0.7 * completeness + 0.3 * freshness);
  // A stale record cannot read as high-confidence even when every field is filled in.
  if (age != null && age > 90) score = Math.min(score, 55);
  return score;
}

export function demandAssessment(m, rules) {
  const signals = [m.actual_work_volume, m.forecasted_demand, m.forward_capacity].filter(has).map(Number);
  if (signals.length === 0) return { status: "Unknown", score: null, conflict: false, spread: 0 };
  const score = Math.max(...signals);
  const spread = signals.length > 1 ? score - Math.min(...signals) : 0;
  const conflict = spread >= num(rules.demand_conflict_spread, 30);
  let status;
  if (score >= rules.high_demand_threshold) status = "High";
  else if (score >= rules.medium_demand_threshold) status = "Medium";
  else status = "Low";
  // Real work on the board today vetoes an optimistic forecast: a market cannot be
  // "High demand" — i.e. safe to hire aggressively into — when technicians have almost
  // nothing to do right now. This is what kept "Ready to Hire" and "Go-Live Blocked"
  // from ever appearing on the same market.
  if (status === "High" && has(m.actual_work_volume) && Number(m.actual_work_volume) < rules.medium_demand_threshold) {
    status = "Medium";
  }
  return { status, score, conflict, spread };
}

export function trainingAssessment(m, rules) {
  if (!has(m.mentor_capacity) || !has(m.training_capacity)) return { status: "Unknown", mentorSupport: null };
  const perMentor = rules.max_pending_starts_per_mentor;
  const mentorSupport = Number(m.mentor_capacity) * perMentor;
  const required = num(m.pending_starts, 0);
  if (Number(m.mentor_capacity) === 0 || Number(m.training_capacity) === 0)
    return { status: "Not Ready", mentorSupport };
  if (mentorSupport >= required && Number(m.training_capacity) >= required)
    return { status: "Ready", mentorSupport };
  return { status: "Limited", mentorSupport };
}

export function adjustedGap(m) {
  if (!has(m.target_headcount) || !has(m.current_headcount)) return null;
  return num(m.target_headcount) - num(m.current_headcount) - num(m.pending_starts, 0) - num(m.pending_offers, 0);
}

export function riskScore(m, rules, ctx) {
  let s = 0;
  const parts = [];
  const contributions = [];
  const add = (factor, p) => { if (p) { s += p; contributions.push({ factor, points: Math.round(p) }); } };

  // Low work volume — up to 25. A missing demand signal is itself a risk, not "safe".
  let p = 0;
  if (has(m.actual_work_volume) || has(m.forecasted_demand)) {
    const wv = has(m.actual_work_volume) ? Number(m.actual_work_volume) : Number(m.forecasted_demand);
    p = wv < 25 ? 25 : wv < 40 ? 16 : wv < 55 ? 8 : 0;
    if (p) parts.push("low work volume");
    add("low work volume", p);
  } else {
    parts.push("no demand signal");
    add("no demand signal", 10);
  }
  // Pending starts > mentor support — up to 20
  if (ctx.mentorSupport != null) {
    const excess = num(m.pending_starts, 0) - ctx.mentorSupport;
    if (excess > 0) {
      parts.push("starts exceed mentor capacity");
      add("starts exceed mentor capacity", Math.min(20, 8 + excess * 6));
    }
  }
  // Limited mentor capacity — up to 20
  if (has(m.mentor_capacity)) {
    const mc = Number(m.mentor_capacity);
    p = mc === 0 ? 20 : mc === 1 ? 10 : mc === 2 ? 4 : 0;
    if (p && (num(m.pending_starts, 0) > 0 || (ctx.gap ?? 0) > 0)) {
      if (mc <= 1) parts.push("thin mentor bench");
      add("thin mentor bench", p);
    }
  }
  // Open reqs greater than adjusted gap — up to 10
  if (has(m.open_reqs) && ctx.gap != null) {
    const over = Number(m.open_reqs) - (ctx.gap + 1);
    if (over > 0) {
      parts.push("open req overload");
      add("open req overload", Math.min(10, 4 + over * 3));
    }
  }
  // High attrition — up to 10
  const attr = num(m.attrition_90_days, 0);
  p = attr >= 25 ? 10 : attr >= 15 ? 6 : attr >= 10 ? 3 : 0;
  if (p) parts.push("elevated attrition");
  add("elevated attrition", p);
  // Skill mismatch / weak skill demand — up to 10
  if (has(m.skill_match)) {
    const sm = Number(m.skill_match);
    p = sm < 40 ? 10 : sm < 55 ? 6 : sm < 70 ? 3 : 0;
    if (p) parts.push("skill supply gap");
    add("skill supply gap", p);
  }
  // Missing data — up to 5
  add("missing data", Math.min(5, missingFields(m).length));
  return { score: clamp(Math.round(s), 0, 100), drivers: parts, contributions };
}

export function priorityScore(m, rules, ctx) {
  let s = 0;
  const contributions = [];
  const add = (factor, p) => { if (p) { s += p; contributions.push({ factor, points: Math.round(p) }); } };
  add("staffing gap", ctx.gap > 0 ? Math.min(25, ctx.gap * 6) : 0);
  add("forecast demand", (num(m.forecasted_demand) / 100) * 20);
  add("work volume", (num(m.actual_work_volume) / 100) * 15);
  add("forward capacity", (num(m.forward_capacity) / 100) * 15);
  add("attrition backfill", Math.min(10, (num(m.attrition_90_days) / 30) * 10));
  const pr = m.market_priority === "High" ? 8 : m.market_priority === "Medium" ? 4 : m.market_priority === "Low" ? 1 : 0;
  add("market priority / focus", clamp(pr + (m.is_focus_market ? 4 : 0), 0, 10));
  add("recruiter pipeline", Math.min(5, num(m.recruiter_pipeline_count) * 0.7));
  return { score: clamp(Math.round(s), 0, 100), contributions };
}

export function readinessScore(m, rules, ctx) {
  let s = 0;
  const contributions = [];
  const add = (factor, p) => { if (p) { s += p; contributions.push({ factor, points: Math.round(p) }); } };
  add("staffing gap", ctx.gap > 0 ? Math.min(20, ctx.gap * 5) : 0);
  add("demand health", (num(ctx.demandScore) / 100) * 25);
  add("forecast demand", (num(m.forecasted_demand) / 100) * 10);
  add("forward capacity", (num(m.forward_capacity) / 100) * 10);
  if (has(m.mentor_capacity) && Number(m.mentor_capacity) > 0) {
    const need = Math.max(1, num(m.pending_starts, 0));
    add("mentor adequacy", Math.min(12, (ctx.mentorSupport / need) * 12));
  }
  if (has(m.training_capacity) && Number(m.training_capacity) > 0) {
    const need = Math.max(1, num(m.pending_starts, 0));
    add("training adequacy", Math.min(10, (Number(m.training_capacity) / need) * 10));
  }
  // Only credit skill match when it is actually known — never invent a neutral score.
  if (has(m.skill_match)) add("skill match", (Number(m.skill_match) / 100) * 8);
  if (ctx.mentorSupport != null) {
    const excess = num(m.pending_starts, 0) - ctx.mentorSupport;
    if (excess > 0) add("start overload penalty", -Math.min(15, excess * 5));
  }
  if (m.is_focus_market) add("focus market boost", num(rules.focus_market_boost, 10));
  if (m.is_union_market) add("union ramp friction", num(rules.union_market_adjustment, -5));
  // Confidence haircut: low-confidence data cannot present as high readiness.
  s = s * (0.65 + 0.35 * (num(ctx.confidence, 60) / 100));
  return { score: clamp(Math.round(s), 0, 100), contributions };
}

function isDataIncomplete(m) {
  if (!has(m.target_headcount) || !has(m.current_headcount)) return true;
  const critical = ["mentor_capacity", "training_capacity", "forward_capacity", "forecasted_demand"];
  const missing = critical.filter((f) => !has(m[f])).length;
  return missing >= 2;
}

const HIRING_MODE = {
  "Ready to Hire": "Aggressive",
  "Pipeline Only": "Pipeline",
  "Stagger Starts": "Staggered",
  "Demand First": "Demand-Led",
  "Training First": "Training-Led",
  "Leadership Exception": "Exception",
  "At Risk": "Hold",
  Hold: "Hold",
  "Data Incomplete": "Hold",
};

const ACTION = {
  "Ready to Hire": "Source aggressively",
  "Pipeline Only": "Build pipeline and keep candidates warm",
  "Stagger Starts": "Continue pipeline but limit start volume",
  "Demand First": "Alert demand / marketing before additional starts",
  "Training First": "Confirm mentor / training capacity before moving starts",
  "At Risk": "Escalate before pushing candidates",
  "Leadership Exception": "Continue per leadership direction and document risk",
  "Data Incomplete": "Validate data before decision",
  Hold: "Minimal recruiter effort",
};

export function goLive(m, rules, ctx) {
  const criticalMissing = !has(m.mentor_capacity) || !has(m.forward_capacity) || !has(m.actual_work_volume);
  const daysUntil = m.next_start_date ? daysBetween(new Date().toISOString(), m.next_start_date) : null;
  const within = daysUntil != null && daysUntil >= 0 && daysUntil <= rules.go_live_risk_window_days;
  const lowWork = has(m.actual_work_volume) ? Number(m.actual_work_volume) < rules.low_demand_threshold : ctx.demandStatus === "Low";
  const pending = num(m.pending_starts, 0);

  if (criticalMissing) {
    return { status: "Unknown", explanation: "Go-live cannot be assessed — mentor capacity, forward capacity, or work volume is missing.", daysUntil };
  }
  if (pending > 0 && (Number(m.mentor_capacity) === 0 || Number(m.training_capacity) === 0)) {
    return { status: "Blocked", explanation: `Blocked: ${pending} start(s) scheduled with no ${Number(m.mentor_capacity) === 0 ? "mentor" : "training"} capacity in market.`, daysUntil };
  }
  if (ctx.mentorSupport != null && pending > ctx.mentorSupport) {
    return { status: "Blocked", explanation: `Blocked: ${pending} pending starts exceed mentor capacity for ${ctx.mentorSupport} safe starts.`, daysUntil };
  }
  if (within && lowWork) {
    return { status: "Blocked", explanation: `Blocked: start in ${daysUntil} day(s) but work volume is low — new tech would have no work.`, daysUntil };
  }
  if (ctx.demandStatus === "Medium" || ctx.trainingStatus === "Limited") {
    return { status: "Watch", explanation: `Watch: ${ctx.demandStatus === "Medium" ? "demand is only medium" : "training capacity is limited"} — confirm support before start.`, daysUntil };
  }
  if (ctx.demandStatus === "High" && (ctx.mentorSupport == null || pending <= ctx.mentorSupport) && Number(m.training_capacity) >= pending) {
    return { status: "Ready", explanation: "Ready: strong demand, mentor capacity available, and training capacity in place.", daysUntil };
  }
  return { status: "Unknown", explanation: "Go-live status indeterminate from current signals.", daysUntil };
}

export function partTimeSuggested(m, rules) {
  const gap = adjustedGap(m);
  return (
    gap != null && gap > 0 &&
    has(m.forecasted_demand) && Number(m.forecasted_demand) < rules.part_time_threshold &&
    has(m.actual_work_volume) && Number(m.actual_work_volume) < rules.part_time_threshold
  );
}

/**
 * Where a market sits on the demand-vs-supply balance — the product's core lens.
 *  - Understaffed:     demand exists and there is an unfilled gap → add supply.
 *  - Capacity-blocked: demand and a gap exist, but the field can't absorb new supply yet.
 *  - Demand-soft:      a gap exists but demand doesn't justify adding supply.
 *  - Supply-met:       at or above target — supply already meets demand.
 *  - Unknown:          not enough data to judge.
 */
export function demandSupplyState(d) {
  if (d.readiness_status === "Data Incomplete") return "Unknown";
  const gap = d.adjusted_staffing_gap ?? 0;
  if (gap <= 0) return "Supply-met";
  if (d.demand_status === "Low" || d.demand_status === "Unknown") return "Demand-soft";
  if (d.training_status === "Not Ready" || d.training_status === "Limited") return "Capacity-blocked";
  return "Understaffed";
}

export function buildExplanation(m, d) {
  const g = d.adjusted_staffing_gap;
  switch (d.readiness_status) {
    case "Ready to Hire":
      return `${m.market} ${m.skill_type} is Ready to Hire — adjusted staffing gap of ${g}, ${d.demand_status.toLowerCase()} demand, and mentor capacity available to support starts. Risk is ${d.risk_level.toLowerCase()}.`;
    case "Pipeline Only":
      return `${m.market} ${m.skill_type} is Pipeline Only — a gap of ${g} exists but demand is only ${d.demand_status.toLowerCase()}, so build a warm pipeline rather than pushing starts.`;
    case "Stagger Starts":
      return `${m.market} ${m.skill_type} is Stagger Starts — demand exists, but ${m.pending_starts} pending start(s) exceed available mentor capacity${d.training_status === "Limited" ? " and training capacity is limited" : ""}. Space out start dates.`;
    case "Demand First":
      return `${m.market} ${m.skill_type} is Demand First — a hiring need of ${g} exists, but current work volume and forward-looking demand are low. Create demand before adding starts.`;
    case "Training First":
      return `${m.market} ${m.skill_type} is Training First — a gap of ${g} exists but mentor / training capacity is not ready to absorb new techs. Build field support first.`;
    case "At Risk":
      return `${m.market} ${m.skill_type} is At Risk — risk score of ${d.risk_score} (${d.risk_level}) driven by ${d.risk_drivers.join(", ") || "multiple factors"}. Escalate before pushing candidates.`;
    case "Leadership Exception":
      return `${m.market} ${m.skill_type} is a Leadership Exception — hiring is continuing despite system-identified risk (${d.risk_level}). ${m.exception_reason ? "Reason: " + m.exception_reason + "." : "No exception reason documented yet."}`;
    case "Data Incomplete":
      return `${m.market} ${m.skill_type} is Data Incomplete — recommendation confidence is ${d.confidence_score}% because ${d.missing_fields.slice(0, 3).join(", ") || "critical fields"} ${d.missing_fields.length > 1 ? "are" : "is"} missing.`;
    case "Hold":
      return `${m.market} ${m.skill_type} is Hold — adjusted staffing gap is ${g} (at or above target) with no leadership exception. Apply minimal recruiter effort.`;
    default:
      return `${m.market} ${m.skill_type}: ${d.readiness_status}.`;
  }
}

/**
 * Core entry point. Returns the full derived recommendation for a market.
 */
export function computeRecommendation(m, rules) {
  const gap = adjustedGap(m);
  const confidence = confidenceScore(m);
  const demand = demandAssessment(m, rules);
  const training = trainingAssessment(m, rules);
  const ctx = {
    gap: gap ?? 0,
    confidence,
    demandScore: demand.score ?? 0,
    demandStatus: demand.status,
    trainingStatus: training.status,
    mentorSupport: training.mentorSupport,
  };

  const risk = riskScore(m, rules, ctx);
  const priority = priorityScore(m, rules, ctx);
  const readiness = readinessScore(m, rules, ctx);

  const riskLevel =
    risk.score >= rules.critical_risk_threshold ? "Critical" :
    risk.score >= rules.high_risk_threshold ? "High" :
    risk.score >= 25 ? "Medium" : "Low";

  const missing = missingFields(m);

  // Readiness status decision tree
  let status;
  if (isDataIncomplete(m)) status = "Data Incomplete";
  else if (m.leadership_exception) status = "Leadership Exception";
  else if (gap != null && gap <= 0) status = "Hold";
  else if (riskLevel === "High" || riskLevel === "Critical") status = "At Risk";
  else if (training.status === "Not Ready") status = "Training First";
  else if (demand.status === "Low") status = "Demand First";
  else if (demand.status === "Medium") status = "Pipeline Only";
  else if (demand.status === "High") {
    if (training.status === "Limited" || (ctx.mentorSupport != null && num(m.pending_starts, 0) > ctx.mentorSupport))
      status = "Stagger Starts";
    else status = "Ready to Hire";
  } else status = "Pipeline Only";

  let hiringMode = HIRING_MODE[status] || "Hold";
  if (status === "Ready to Hire" && readiness.score < rules.high_readiness_threshold) hiringMode = "Balanced";

  const gl = goLive(m, rules, ctx);
  const partTime = partTimeSuggested(m, rules);

  const d = {
    market_id: m.id,
    adjusted_staffing_gap: gap,
    demand_status: demand.status,
    demand_score: demand.score,
    demand_conflict: demand.conflict || false,
    training_status: training.status,
    mentor_support: ctx.mentorSupport,
    market_readiness_score: readiness.score,
    priority_score: priority.score,
    risk_score: risk.score,
    risk_drivers: risk.drivers,
    confidence_score: confidence,
    risk_level: riskLevel,
    readiness_status: status,
    hiring_mode: hiringMode,
    recommended_action: ACTION[status] || "Review",
    go_live_status: gl.status,
    go_live_explanation: gl.explanation,
    days_until_start: gl.daysUntil,
    part_time_suggested: partTime,
    missing_fields: missing,
    stale_fields: staleFields(m),
    // Trust instrumentation: how each score was built, when data is too thin to trust,
    // and where two surfaces would otherwise disagree.
    contributions: { risk: risk.contributions, priority: priority.contributions, readiness: readiness.contributions },
    reference_only: status === "Data Incomplete" || confidence < 40,
    status_conflict: (status === "At Risk" || status === "Hold") && priority.score >= 65,
    calculated_at: new Date().toISOString(),
  };
  d.demand_supply_state = demandSupplyState(d);
  d.explanation = buildExplanation(m, d);
  if (d.demand_conflict)
    d.explanation += ` Note: demand signals disagree by ${demand.spread} points — the optimistic reading is not trusted on its own.`;
  if (d.status_conflict)
    d.explanation += " This market also ranks high on priority — reconcile the priority queue with the hold/at-risk action before deciding.";
  if (partTime) d.explanation += " Forecast demand is thin — a part-time technician may fit better than a full-time hire.";
  return d;
}

/**
 * Derive signals (informational) and risks (owned, actionable) for a market.
 */
export function generateAlerts(m, rules, d) {
  const alerts = [];
  const owner = m.owner || "Unassigned";
  const gap = d.adjusted_staffing_gap ?? 0;
  const pending = num(m.pending_starts, 0);

  if (d.demand_status === "Low" && pending > 0)
    alerts.push({ scope: "risk", risk_type: "Demand coverage", severity: "High", explanation: `Work volume is low but ${pending} start(s) are pending — new techs may have no work.`, owner, next_step: "Open a demand handoff before starts land." });

  if (d.training_status === "Not Ready" && gap > 0)
    alerts.push({ scope: "risk", risk_type: "Training capacity", severity: "High", explanation: `Mentor / training capacity is not ready for a gap of ${gap}.`, owner, next_step: "Confirm mentor availability before moving starts." });

  if (d.mentor_support != null && pending > d.mentor_support)
    alerts.push({ scope: "risk", risk_type: "Mentor overload", severity: "High", explanation: `${pending} pending starts exceed safe mentor capacity (${d.mentor_support}).`, owner, next_step: "Stagger start dates across weeks." });

  if (has(m.open_reqs) && Number(m.open_reqs) > gap + 1)
    alerts.push({ scope: "signal", signal_type: "Req overload", severity: "Medium", explanation: `${m.open_reqs} open reqs against an adjusted gap of ${gap} — likely duplicate / stale reqs.`, owner, next_step: "Review and close duplicate requisitions." });

  if (d.risk_score >= rules.high_risk_threshold)
    alerts.push({ scope: "risk", risk_type: "Elevated risk", severity: d.risk_level, explanation: `Risk score ${d.risk_score} (${d.risk_level}) — ${d.risk_drivers.join(", ") || "multiple drivers"}.`, owner, next_step: "Escalate before continuing to push candidates." });

  if (d.days_until_start != null && d.days_until_start >= 0 && d.days_until_start <= rules.go_live_risk_window_days && d.demand_status === "Low")
    alerts.push({ scope: "risk", risk_type: "Go-live risk", severity: "Critical", explanation: `Start in ${d.days_until_start} day(s) with low work volume.`, owner, next_step: "Escalate demand support or move the start date." });

  if (d.missing_fields.length > 0)
    alerts.push({ scope: "signal", signal_type: "Data gap", severity: "Low", explanation: `Missing: ${d.missing_fields.join(", ")}.`, owner, next_step: "Update source data to raise confidence." });

  if (m.leadership_exception && !has(m.exception_reason))
    alerts.push({ scope: "signal", signal_type: "Exception undocumented", severity: "Medium", explanation: "Leadership exception is active but no reason is recorded.", owner, next_step: "Document the exception reason and approver." });

  if (m.previous_readiness_status === "Ready to Hire" && d.readiness_status === "At Risk")
    alerts.push({ scope: "signal", signal_type: "Status regression", severity: "High", explanation: "Market moved from Ready to Hire to At Risk since last update.", owner, next_step: "Review what changed and re-confirm plan." });

  if (d.days_until_start != null && d.days_until_start >= 0 && d.days_until_start <= 30 && has(m.actual_work_volume) && Number(m.actual_work_volume) < rules.low_demand_threshold && pending > 0)
    alerts.push({ scope: "risk", risk_type: "No work, upcoming start", severity: "High", explanation: `Upcoming start in ${d.days_until_start} day(s) but almost no current work volume.`, owner, next_step: "Create demand handoff or re-time the start." });

  return alerts;
}

export const STATUS_LIST = [
  "Ready to Hire", "Pipeline Only", "Stagger Starts", "Demand First",
  "Training First", "At Risk", "Leadership Exception", "Data Incomplete", "Hold",
];
