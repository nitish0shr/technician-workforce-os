import express from "express";
import { db, logAudit } from "./db.js";
import { computeRecommendation, rulesToMap, DEFAULT_RULES, STATUS_LIST } from "./scoring.js";
import { getRulesMap, enrich, allMarketsEnriched, marketById } from "./compute.js";
import { parseCSV, toCSV, coerceMarketRow, MARKET_CSV_COLUMNS } from "./csv.js";
import { retentionSummary } from "./pipeline.js";
import { reqPlannerReport } from "./reqplanner.js";

const tally = (arr) => { const m = {}; for (const x of arr) m[x] = (m[x] || 0) + 1; return m; };
const allTechnicians = () => db.prepare("SELECT * FROM technicians").all();

const router = express.Router();
const nowISO = () => new Date().toISOString();

/* ----------------------------- health ----------------------------- */
router.get("/health", (req, res) => {
  // A real health check touches storage so a wedged DB surfaces as unhealthy.
  try {
    const markets = db.prepare("SELECT COUNT(*) c FROM markets").get().c;
    res.json({ ok: true, time: nowISO(), markets });
  } catch (e) {
    res.status(503).json({ ok: false, time: nowISO(), error: "database unavailable" });
  }
});

/* ----------------------------- rules ------------------------------ */
router.get("/rules", (req, res) => {
  res.json(db.prepare("SELECT * FROM business_rules ORDER BY category, rule_name").all());
});

const VALID_RULES = new Set(DEFAULT_RULES.map((d) => d.rule_name));

router.put("/rules", (req, res) => {
  const updates = Array.isArray(req.body) ? req.body : req.body?.rules || [];
  const upd = db.prepare("UPDATE business_rules SET rule_value = ? WHERE rule_name = ?");
  const rejected = [];
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      // Only known rules, and only finite, sane values — a bad threshold silently
      // breaks every downstream recommendation, so reject rather than store garbage.
      if (!VALID_RULES.has(r.rule_name)) { rejected.push(r.rule_name); continue; }
      const v = Number(r.rule_value);
      if (!Number.isFinite(v) || v < -1000 || v > 100_000_000) { rejected.push(r.rule_name); continue; }
      const prev = db.prepare("SELECT rule_value FROM business_rules WHERE rule_name = ?").get(r.rule_name);
      if (!prev) continue;
      if (Number(prev.rule_value) === v) continue;
      upd.run(v, r.rule_name);
      logAudit({ entity_type: "business_rule", entity_id: null, action: "update", previous_value: { [r.rule_name]: prev.rule_value }, new_value: { [r.rule_name]: v }, changed_by: req.body?.changed_by || "admin", reason: "Threshold update" });
    }
  });
  tx(updates);
  const out = db.prepare("SELECT * FROM business_rules ORDER BY category, rule_name").all();
  if (rejected.length) return res.status(207).json({ rules: out, rejected });
  res.json(out);
});

router.post("/rules/reset", (req, res) => {
  const upd = db.prepare("UPDATE business_rules SET rule_value = ? WHERE rule_name = ?");
  const tx = db.transaction(() => DEFAULT_RULES.forEach((d) => upd.run(d.rule_value, d.rule_name)));
  tx();
  logAudit({ entity_type: "business_rule", action: "reset", changed_by: "admin", reason: "Reset to defaults" });
  res.json(db.prepare("SELECT * FROM business_rules ORDER BY category, rule_name").all());
});

/* ----------------------------- markets ---------------------------- */
router.get("/markets", (req, res) => res.json(allMarketsEnriched()));

router.get("/markets/:id", (req, res) => {
  const m = marketById(Number(req.params.id));
  if (!m) return res.status(404).json({ error: "Market not found" });
  m.handoffs = db.prepare("SELECT * FROM handoffs WHERE market_id = ? ORDER BY updated_at DESC").all(m.id);
  m.decisions = db.prepare("SELECT * FROM decisions WHERE market_id = ? ORDER BY decision_date DESC").all(m.id);
  m.exception = db.prepare("SELECT * FROM leadership_exceptions WHERE market_id = ? ORDER BY id DESC").get(m.id) || null;
  m.audit = db.prepare("SELECT * FROM audit_log WHERE entity_type='market' AND entity_id = ? ORDER BY changed_at DESC LIMIT 25").all(m.id);
  res.json(m);
});

const EDITABLE = MARKET_CSV_COLUMNS.filter((c) => c !== "id");

router.post("/markets", (req, res) => {
  const data = coerceMarketRow(req.body);
  if (!data.market) return res.status(400).json({ error: "market is required" });
  data.last_updated = data.last_updated || nowISO().slice(0, 10);
  const cols = Object.keys(data);
  const info = db.prepare(`INSERT INTO markets (${cols.join(",")}) VALUES (${cols.map((c) => "@" + c).join(",")})`).run(data);
  logAudit({ entity_type: "market", entity_id: info.lastInsertRowid, action: "create", new_value: data, changed_by: req.body?.changed_by || "user", reason: req.body?.reason || "Created market" });
  res.json(marketById(info.lastInsertRowid));
});

router.put("/markets/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM markets WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Market not found" });
  const rules = getRulesMap();
  const prevRec = computeRecommendation(existing, rules);

  const data = coerceMarketRow(req.body);
  const changedCols = Object.keys(data).filter((c) => EDITABLE.includes(c));
  if (!changedCols.length) return res.json(marketById(id));

  const prevValues = {};
  changedCols.forEach((c) => (prevValues[c] = existing[c]));
  data.last_updated = nowISO().slice(0, 10);
  const setCols = [...changedCols, "last_updated"];

  const merged = { ...existing, ...data };
  const newRec = computeRecommendation(merged, rules);
  if (newRec.readiness_status !== prevRec.readiness_status) {
    merged.previous_readiness_status = prevRec.readiness_status;
    setCols.push("previous_readiness_status");
    data.previous_readiness_status = prevRec.readiness_status;
  }

  db.prepare(`UPDATE markets SET ${setCols.map((c) => c + " = @" + c).join(", ")} WHERE id = @id`).run({ ...data, id });
  logAudit({ entity_type: "market", entity_id: id, action: "update", previous_value: prevValues, new_value: data, changed_by: req.body?.changed_by || "user", reason: req.body?.reason || "Edited market data" });
  if (newRec.readiness_status !== prevRec.readiness_status) {
    logAudit({ entity_type: "market", entity_id: id, action: "status_change", previous_value: { readiness_status: prevRec.readiness_status }, new_value: { readiness_status: newRec.readiness_status }, changed_by: "scoring-engine", reason: "Recomputed after data change." });
  }
  res.json(marketById(id));
});

router.delete("/markets/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM markets WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Market not found" });
  db.prepare("DELETE FROM markets WHERE id = ?").run(id);
  logAudit({ entity_type: "market", entity_id: id, action: "delete", previous_value: { market: existing.market }, changed_by: "user", reason: "Deleted market" });
  res.json({ ok: true });
});

/* --------------------------- command center ----------------------- */
function isWithinDays(dateStr, days) {
  if (!dateStr) return false;
  const d = Math.round((new Date(dateStr) - new Date()) / 86400000);
  return d >= 0 && d <= days;
}

router.get("/summary", (req, res) => {
  const markets = allMarketsEnriched();
  const wf = retentionSummary(allTechnicians()); // real active-workforce trend for the hero
  const byStatus = {};
  for (const m of markets) byStatus[m.rec.readiness_status] = (byStatus[m.rec.readiness_status] || 0) + 1;

  const pushNow = markets.filter((m) => ["Ready to Hire"].includes(m.rec.readiness_status));
  const atRisk = markets.filter((m) => ["At Risk"].includes(m.rec.readiness_status) || m.rec.risk_level === "Critical");
  const startsSoon = markets.filter((m) => isWithinDays(m.next_start_date, 7) && (m.pending_starts || 0) > 0);
  const goLiveRisk = startsSoon.filter((m) => m.rec.go_live_status === "Blocked" || m.rec.go_live_status === "Watch");
  const demandFirst = markets.filter((m) => m.rec.readiness_status === "Demand First");
  const stagger = markets.filter((m) => m.rec.readiness_status === "Stagger Starts");

  // Decision queue
  const decisionQueue = [];
  for (const m of markets) {
    if (m.rec.readiness_status === "Leadership Exception" && !m.exception_reason)
      decisionQueue.push({ market_id: m.id, market: m.market, skill: m.skill_type, type: "Approve leadership exception", owner: m.owner, urgency: "High" });
    if (m.rec.readiness_status === "At Risk")
      decisionQueue.push({ market_id: m.id, market: m.market, skill: m.skill_type, type: "Request leadership exception", owner: m.owner, urgency: "High" });
    if (m.rec.training_status === "Not Ready" && (m.rec.adjusted_staffing_gap || 0) > 0)
      decisionQueue.push({ market_id: m.id, market: m.market, skill: m.skill_type, type: "Confirm mentor availability", owner: m.owner, urgency: "Medium" });
    if (m.rec.readiness_status === "Demand First")
      decisionQueue.push({ market_id: m.id, market: m.market, skill: m.skill_type, type: "Confirm demand support", owner: m.owner, urgency: "Medium" });
    if ((m.open_reqs || 0) > (m.rec.adjusted_staffing_gap || 0) + 1)
      decisionQueue.push({ market_id: m.id, market: m.market, skill: m.skill_type, type: "Review duplicate req", owner: m.owner, urgency: "Low" });
    if (m.rec.readiness_status === "Stagger Starts")
      decisionQueue.push({ market_id: m.id, market: m.market, skill: m.skill_type, type: "Stagger start date", owner: m.owner, urgency: "Medium" });
  }

  const topPriority = [...markets].sort((a, b) => b.rec.priority_score - a.rec.priority_score).slice(0, 8)
    .map((m) => ({ id: m.id, market: m.market, skill: m.skill_type, planning_area: m.planning_area, priority_score: m.rec.priority_score, readiness_status: m.rec.readiness_status, hiring_mode: m.rec.hiring_mode, adjusted_staffing_gap: m.rec.adjusted_staffing_gap, owner: m.owner }));

  const riskQueue = [...markets].filter((m) => m.rec.risk_score >= 35)
    .sort((a, b) => b.rec.risk_score - a.rec.risk_score).slice(0, 10)
    .map((m) => ({ id: m.id, market: m.market, skill: m.skill_type, risk_score: m.rec.risk_score, risk_level: m.rec.risk_level, drivers: m.rec.risk_drivers, owner: m.owner, next_step: m.alerts.find((a) => a.scope === "risk")?.next_step || "Review risk drivers." }));

  const changes = db.prepare("SELECT * FROM audit_log WHERE action IN ('status_change','escalated','approved','update') ORDER BY changed_at DESC LIMIT 12").all()
    .map((c) => ({ ...c, previous_value: safeParse(c.previous_value), new_value: safeParse(c.new_value) }));

  // Demand vs supply is the lens: where demand outpaces supply, and where it doesn't.
  const byState = (s) => markets.filter((m) => m.rec.demand_supply_state === s).length;
  const understaffed = byState("Understaffed");

  const signal = `${byStatus["Ready to Hire"] || 0} markets have demand outpacing supply and are ready to hire, ${byStatus["Stagger Starts"] || 0} need staggered starts, ${demandFirst.length} have a gap but demand is too soft to add supply, and ${goLiveRisk.length} upcoming start(s) carry go-live risk.`;

  // Distributions for the Command Center charts.
  const actionDistribution = STATUS_LIST.filter((s) => byStatus[s]).map((s) => ({ status: s, count: byStatus[s] }));
  const riskDistribution = ["Low", "Medium", "High", "Critical"].map((level) => ({ level, count: markets.filter((m) => m.rec.risk_level === level).length }));

  const memo = buildMemo(markets, byStatus, { goLiveRisk, atRisk, demandFirst, stagger, pushNow, understaffed });

  res.json({
    generated_at: nowISO(),
    signal,
    workforce: { active: wf.active, trend: wf.headcount_trend, series: wf.headcount_series, attrition: wf.attrition_rate },
    byStatus,
    understaffed,
    capacityBlocked: byState("Capacity-blocked"),
    actionDistribution,
    riskDistribution,
    counts: {
      pushNow: pushNow.length,
      atRisk: atRisk.length,
      startsNext7: startsSoon.length,
      needsDecision: dedupeDecisions(decisionQueue).length,
    },
    cards: {
      pushNow: pushNow.slice(0, 6).map(slim),
      atRisk: atRisk.slice(0, 6).map(slim),
      startsSoon: startsSoon.slice(0, 6).map(slim),
    },
    topPriority,
    riskQueue,
    decisionQueue: dedupeDecisions(decisionQueue).slice(0, 12),
    changes,
    memo,
  });
});

function slim(m) {
  return { id: m.id, market: m.market, skill: m.skill_type, planning_area: m.planning_area, readiness_status: m.rec.readiness_status, hiring_mode: m.rec.hiring_mode, risk_level: m.rec.risk_level, risk_score: m.rec.risk_score, go_live_status: m.rec.go_live_status, adjusted_staffing_gap: m.rec.adjusted_staffing_gap, pending_starts: m.pending_starts, next_start_date: m.next_start_date, owner: m.owner, confidence_score: m.rec.confidence_score };
}
function dedupeDecisions(list) {
  const seen = new Set();
  return list.filter((d) => { const k = d.market_id + d.type; if (seen.has(k)) return false; seen.add(k); return true; });
}
function safeParse(s) { try { return s ? JSON.parse(s) : null; } catch { return s; } }

function buildMemo(markets, byStatus, g) {
  const total = markets.length;
  const ready = byStatus["Ready to Hire"] || 0;
  const lines = [];
  if (g.understaffed > 0)
    lines.push(`Bottom line: demand is outpacing supply in ${g.understaffed} market(s) that are ready to hire, while ${g.demandFirst.length} have a gap but demand too soft to justify adding supply.`);
  lines.push(`Workforce posture across ${total} markets: ${ready} ready to hire, ${g.stagger.length} staggering starts, ${g.demandFirst.length} demand-led, ${g.atRisk.length} at risk.`);
  if (g.pushNow.length) lines.push(`Push now: ${g.pushNow.slice(0, 5).map((m) => m.market + " " + m.skill_type).join(", ")}.`);
  if (g.atRisk.length) lines.push(`Risk ownership: ${g.atRisk.slice(0, 5).map((m) => m.market).join(", ")} carry system-identified risk and need an owner before hiring continues.`);
  if (g.goLiveRisk.length) lines.push(`${g.goLiveRisk.length} imminent start(s) face go-live risk from low work or thin mentor capacity.`);
  lines.push(`We are not stopping hiring. We are prioritizing hiring effort, making operational risk visible, and protecting retention before new hires are affected.`);
  return lines.join(" ");
}

/* --------------------------- start readiness ---------------------- */
router.get("/start-readiness", (req, res) => {
  const markets = allMarketsEnriched().filter((m) => m.next_start_date && (m.pending_starts || 0) > 0);
  const row = (m) => ({
    id: m.id, market: m.market, planning_area: m.planning_area, skill: m.skill_type,
    pending_starts: m.pending_starts, next_start_date: m.next_start_date, days_until_start: m.rec.days_until_start,
    work_volume: m.actual_work_volume, forward_capacity: m.forward_capacity, mentor_capacity: m.mentor_capacity,
    training_capacity: m.training_capacity, skill_match: m.skill_match, go_live_status: m.rec.go_live_status,
    go_live_explanation: m.rec.go_live_explanation, owner: m.owner,
    action_needed: actionNeeded(m), demand_status: m.rec.demand_status, training_status: m.rec.training_status,
  });
  const within = (d) => markets.filter((m) => m.rec.days_until_start != null && m.rec.days_until_start <= d).sort((a, b) => (a.rec.days_until_start ?? 99) - (b.rec.days_until_start ?? 99)).map(row);
  res.json({ next7: within(7), next14: within(14), next30: within(30), all: markets.sort((a, b) => (a.rec.days_until_start ?? 99) - (b.rec.days_until_start ?? 99)).map(row) });
});

function actionNeeded(m) {
  switch (m.rec.go_live_status) {
    case "Blocked": return "Escalate now — open demand handoff or re-time the start.";
    case "Watch": return "Confirm demand + mentor support this week.";
    case "Ready": return "On track — no action needed.";
    default: return "Validate missing capacity data.";
  }
}

/* ------------------------------ handoffs --------------------------- */
router.get("/handoffs", (req, res) => {
  const rows = db.prepare(`SELECT h.*, m.market, m.skill_type, m.pending_starts FROM handoffs h LEFT JOIN markets m ON m.id = h.market_id ORDER BY h.updated_at DESC`).all();
  res.json(rows);
});
router.post("/handoffs", (req, res) => {
  const b = req.body || {};
  const now = nowISO();
  const info = db.prepare(`INSERT INTO handoffs (market_id, handoff_type, owner, deadline, status, demand_gap, needed_work_volume, escalation_level, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(b.market_id || null, b.handoff_type || "Demand / Marketing", b.owner || "Demand Ops", b.deadline || null, b.status || "Not Sent", b.demand_gap ?? null, b.needed_work_volume ?? null, b.escalation_level || "Level 1", b.notes || "", now, now);
  logAudit({ entity_type: "handoff", entity_id: info.lastInsertRowid, action: "create", new_value: b, changed_by: "user", reason: "Created handoff" });
  res.json(db.prepare("SELECT * FROM handoffs WHERE id = ?").get(info.lastInsertRowid));
});
router.put("/handoffs/:id", (req, res) => {
  const id = Number(req.params.id);
  const ex = db.prepare("SELECT * FROM handoffs WHERE id = ?").get(id);
  if (!ex) return res.status(404).json({ error: "Not found" });
  const fields = ["handoff_type", "owner", "deadline", "status", "demand_gap", "needed_work_volume", "escalation_level", "notes"];
  const set = {}; fields.forEach((f) => { if (f in (req.body || {})) set[f] = req.body[f]; });
  set.updated_at = nowISO();
  const cols = Object.keys(set);
  db.prepare(`UPDATE handoffs SET ${cols.map((c) => c + " = @" + c).join(", ")} WHERE id = @id`).run({ ...set, id });
  logAudit({ entity_type: "handoff", entity_id: id, action: "update", previous_value: ex, new_value: set, changed_by: "user", reason: req.body?.reason || "Updated handoff" });
  res.json(db.prepare("SELECT * FROM handoffs WHERE id = ?").get(id));
});
router.delete("/handoffs/:id", (req, res) => {
  db.prepare("DELETE FROM handoffs WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

/* ------------------------- leadership exceptions ------------------- */
router.get("/leadership-exceptions", (req, res) => {
  const rows = db.prepare(`SELECT e.*, m.market, m.skill_type FROM leadership_exceptions e LEFT JOIN markets m ON m.id = e.market_id ORDER BY e.id DESC`).all();
  res.json(rows);
});
router.post("/leadership-exceptions", (req, res) => {
  const b = req.body || {};
  const info = db.prepare(`INSERT INTO leadership_exceptions (market_id, system_recommendation, override_status, risk_level, requested_by, approved_by, approval_date, exception_reason, risk_acknowledged, required_support_team, review_date, outcome, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(b.market_id || null, b.system_recommendation || "", b.override_status || "Requested", b.risk_level || "High", b.requested_by || "", b.approved_by || "", b.approval_date || null, b.exception_reason || "", b.risk_acknowledged ? 1 : 0, b.required_support_team || "", b.review_date || null, b.outcome || "Open", b.notes || "");
  if (b.market_id && (b.override_status === "Approved" || b.approved_by)) {
    db.prepare("UPDATE markets SET leadership_exception = 1, exception_reason = COALESCE(NULLIF(?,''), exception_reason) WHERE id = ?").run(b.exception_reason || "", b.market_id);
  }
  logAudit({ entity_type: "leadership_exception", entity_id: info.lastInsertRowid, action: "create", new_value: b, changed_by: b.requested_by || "user", reason: "Requested/created exception" });
  res.json(db.prepare("SELECT * FROM leadership_exceptions WHERE id = ?").get(info.lastInsertRowid));
});
router.put("/leadership-exceptions/:id", (req, res) => {
  const id = Number(req.params.id);
  const ex = db.prepare("SELECT * FROM leadership_exceptions WHERE id = ?").get(id);
  if (!ex) return res.status(404).json({ error: "Not found" });
  const fields = ["system_recommendation", "override_status", "risk_level", "requested_by", "approved_by", "approval_date", "exception_reason", "risk_acknowledged", "required_support_team", "review_date", "outcome", "notes"];
  const set = {}; fields.forEach((f) => { if (f in (req.body || {})) set[f] = f === "risk_acknowledged" ? (req.body[f] ? 1 : 0) : req.body[f]; });
  const cols = Object.keys(set);
  if (cols.length) db.prepare(`UPDATE leadership_exceptions SET ${cols.map((c) => c + " = @" + c).join(", ")} WHERE id = @id`).run({ ...set, id });
  if (ex.market_id && set.override_status === "Approved") {
    db.prepare("UPDATE markets SET leadership_exception = 1 WHERE id = ?").run(ex.market_id);
  }
  if (ex.market_id && set.override_status === "Withdrawn") {
    db.prepare("UPDATE markets SET leadership_exception = 0 WHERE id = ?").run(ex.market_id);
  }
  logAudit({ entity_type: "leadership_exception", entity_id: id, action: "update", previous_value: ex, new_value: set, changed_by: req.body?.changed_by || "user", reason: req.body?.reason || "Updated exception" });
  res.json(db.prepare("SELECT * FROM leadership_exceptions WHERE id = ?").get(id));
});

/* ------------------------------ decisions -------------------------- */
router.get("/decisions", (req, res) => {
  res.json(db.prepare(`SELECT d.*, m.market, m.skill_type FROM decisions d LEFT JOIN markets m ON m.id = d.market_id ORDER BY d.decision_date DESC`).all());
});
router.post("/decisions", (req, res) => {
  const b = req.body || {};
  const info = db.prepare(`INSERT INTO decisions (market_id, decision_type, decision_summary, decided_by, decision_date, reason, outcome, review_date) VALUES (?,?,?,?,?,?,?,?)`)
    .run(b.market_id || null, b.decision_type || "Decision", b.decision_summary || "", b.decided_by || "", b.decision_date || nowISO().slice(0, 10), b.reason || "", b.outcome || "Open", b.review_date || null);
  logAudit({ entity_type: "decision", entity_id: info.lastInsertRowid, action: "create", new_value: b, changed_by: b.decided_by || "user", reason: "Logged decision" });
  res.json(db.prepare("SELECT * FROM decisions WHERE id = ?").get(info.lastInsertRowid));
});

/* ----------------------------- data health ------------------------- */
router.get("/data-health", (req, res) => {
  const markets = allMarketsEnriched();
  res.json(markets.map((m) => ({
    id: m.id, market: m.market, skill: m.skill_type, planning_area: m.planning_area, owner: m.owner,
    data_health_score: Math.round((10 - m.rec.missing_fields.length) / 10 * 100),
    confidence_score: m.rec.confidence_score,
    missing_fields: m.rec.missing_fields,
    stale_fields: m.rec.stale_fields,
    last_updated: m.last_updated,
    source_of_truth: m.is_union_market ? "HRIS + Local CBA" : "ATS + HRIS",
    readiness_status: m.rec.readiness_status,
    confidence_note: m.rec.missing_fields.length
      ? `Recommendation confidence is ${m.rec.confidence_score}% because ${m.rec.missing_fields.join(", ")} ${m.rec.missing_fields.length > 1 ? "are" : "is"} missing.`
      : `Data complete — confidence ${m.rec.confidence_score}%.`,
  })));
});

/* --------------------------- demand & supply ----------------------- */
router.get("/demand-supply", (req, res) => {
  const markets = allMarketsEnriched();

  const STATES = ["Understaffed", "Capacity-blocked", "Demand-soft", "Supply-met", "Unknown"];
  const byState = Object.fromEntries(STATES.map((s) => [s, 0]));

  const rows = markets.map((m) => {
    const r = m.rec;
    byState[r.demand_supply_state] = (byState[r.demand_supply_state] || 0) + 1;
    return {
      id: m.id, market: m.market, skill: m.skill_type, planning_area: m.planning_area, owner: m.owner,
      state: r.demand_supply_state,
      demand_status: r.demand_status, demand_score: r.demand_score,
      gap: r.adjusted_staffing_gap,          // supply shortfall: positive = need supply, negative = over-supplied
      current_headcount: m.current_headcount, target_headcount: m.target_headcount,
      pending_starts: m.pending_starts, mentor_capacity: m.mentor_capacity, training_status: r.training_status,
      go_live_status: r.go_live_status, readiness_status: r.readiness_status,
      recommended_action: r.recommended_action, recruiter_pipeline: m.recruiter_pipeline_count,
    };
  });

  // Where demand outpaces supply — ranked by the unfilled gap under real demand.
  const understaffed = rows.filter((r) => r.state === "Understaffed" || r.state === "Capacity-blocked")
    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0));
  // Where supply already meets (or exceeds) demand.
  const supplyLed = rows.filter((r) => r.state === "Supply-met" || r.state === "Demand-soft")
    .sort((a, b) => (a.gap ?? 0) - (b.gap ?? 0));

  const byDemand = ["High", "Medium", "Low", "Unknown"].map((level) => ({ level, count: markets.filter((m) => m.rec.demand_status === level).length }));

  res.json({
    generated_at: nowISO(),
    totals: { understaffed: byState["Understaffed"], capacity_blocked: byState["Capacity-blocked"], demand_soft: byState["Demand-soft"], supply_met: byState["Supply-met"] },
    byState, byDemand, understaffed, supplyLed, all: rows,
  });
});

/* ----------------------------- retention --------------------------- */
router.get("/retention", (req, res) => {
  const techs = allTechnicians();
  const summary = retentionSummary(techs);
  // Markets where attrition is high AND demand is strong → "hire, but fix retention first".
  const markets = allMarketsEnriched();
  const demandByMarket = Object.fromEntries(markets.map((m) => [m.market, m.rec.demand_status]));
  const watchouts = summary.byMarket
    .filter((m) => m.attrition_rate >= 15 && (demandByMarket[m.market] === "High" || demandByMarket[m.market] === "Medium"))
    .map((m) => ({ ...m, demand: demandByMarket[m.market] }));
  res.json({ generated_at: nowISO(), ...summary, watchouts });
});

/* ----------------------------- action center ----------------------- */
// One worklist for the recruitment team: where to hire, where to pause, where to
// investigate before hiring. No candidate / source / recruiter data — markets only.
router.get("/action-center", (req, res) => {
  const markets = allMarketsEnriched();
  const ret = retentionSummary(allTechnicians());
  const demandByMarket = Object.fromEntries(markets.map((m) => [m.market, m.rec.demand_status]));
  const items = [];

  for (const m of markets.filter((m) => m.rec.readiness_status === "Ready to Hire")) {
    items.push({ kind: "Hire", severity: m.rec.priority_score >= 70 ? "High" : "Medium", title: `Hire — ${m.market} · ${m.skill_type}`, detail: `Demand outpaces supply (gap ${m.rec.adjusted_staffing_gap}). ${m.rec.recommended_action}.`, owner: m.owner, link: "/market-readiness" });
  }
  for (const m of markets.filter((m) => m.rec.demand_supply_state === "Capacity-blocked" || m.rec.readiness_status === "Training First" || m.rec.readiness_status === "Stagger Starts")) {
    items.push({ kind: "Fix capacity", severity: "Medium", title: `Hold starts — ${m.market} · ${m.skill_type}`, detail: `Demand exists but the field can't absorb new techs yet (training ${m.rec.training_status}). ${m.rec.recommended_action}.`, owner: m.owner, link: "/market-readiness" });
  }
  for (const m of markets.filter((m) => m.rec.readiness_status === "Demand First")) {
    items.push({ kind: "Pause", severity: "Medium", title: `Pause hiring — ${m.market} · ${m.skill_type}`, detail: `A gap exists but demand is too soft to add supply. Create demand before hiring.`, owner: m.owner, link: "/demand-supply" });
  }
  for (const m of markets.filter((m) => m.rec.readiness_status === "Hold")) {
    items.push({ kind: "Pause", severity: "Low", title: `Pause hiring — ${m.market} · ${m.skill_type}`, detail: `Supply already meets demand (at or above target). Minimal hiring effort.`, owner: m.owner, link: "/demand-supply" });
  }
  for (const m of ret.byMarket.filter((m) => m.attrition_rate >= 20 && (demandByMarket[m.market] === "High" || demandByMarket[m.market] === "Medium")).slice(0, 6)) {
    items.push({ kind: "Investigate", severity: "High", title: `Investigate before hiring — ${m.market}`, detail: `${m.attrition_rate}% recent attrition (${m.early_attrition} early exits) with active demand — fix retention before adding hires.`, owner: "Field Ops", link: "/retention" });
  }
  for (const m of markets.filter((m) => m.rec.readiness_status === "At Risk").slice(0, 8)) {
    items.push({ kind: "Decision", severity: "High", title: `Decide — ${m.market} · ${m.skill_type} is At Risk`, detail: m.rec.recommended_action, owner: m.owner, link: "/leadership-decisions" });
  }

  const sevOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  items.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  const byKind = tally(items.map((i) => i.kind));
  res.json({ generated_at: nowISO(), total: items.length, byKind, items });
});

/* ----------------------------- req planner ------------------------- */
router.get("/req-planner", (req, res) => {
  const areas = db.prepare("SELECT * FROM planning_areas ORDER BY code").all();
  const metrics = db.prepare("SELECT * FROM area_metrics").all();
  res.json({ generated_at: nowISO(), ...reqPlannerReport(areas, metrics) });
});

/* ------------------------------- changes --------------------------- */
router.get("/changes", (req, res) => {
  const rows = db.prepare("SELECT * FROM audit_log ORDER BY changed_at DESC LIMIT 40").all()
    .map((c) => ({ ...c, previous_value: safeParse(c.previous_value), new_value: safeParse(c.new_value) }));
  res.json(rows);
});

/* ------------------------------ scenarios -------------------------- */
function aggregate(markets, rules) {
  let ready = 0, atRisk = 0, blocked = 0, overloadStarts = 0, demandNeeded = 0;
  const byStatus = {};
  for (const m of markets) {
    const rec = computeRecommendation(m, rules);
    byStatus[rec.readiness_status] = (byStatus[rec.readiness_status] || 0) + 1;
    if (rec.readiness_status === "Ready to Hire") ready++;
    if (rec.risk_level === "High" || rec.risk_level === "Critical") atRisk++;
    if (rec.go_live_status === "Blocked") blocked++;
    if (rec.mentor_support != null && (m.pending_starts || 0) > rec.mentor_support) overloadStarts += (m.pending_starts || 0) - rec.mentor_support;
    if (rec.readiness_status === "Demand First" || (rec.demand_status === "Low" && (m.pending_starts || 0) > 0)) demandNeeded++;
  }
  return { ready, atRisk, blocked, overloadStarts, demandNeeded, byStatus };
}

router.post("/scenarios/run", (req, res) => {
  const { scenario, params = {} } = req.body || {};
  const rules = getRulesMap();
  const base = db.prepare("SELECT * FROM markets").all();
  const baseline = aggregate(base, rules);

  let clone = base.map((m) => ({ ...m }));
  let summary = "";
  const pct = Number(params.pct || 10) / 100;
  const n = Number(params.count || 1);

  switch (scenario) {
    case "hire_2_per_area": {
      const seen = new Set();
      clone.forEach((m) => { if (!seen.has(m.planning_area)) { seen.add(m.planning_area); m.pending_starts = (m.pending_starts || 0) + 2; } });
      summary = "Adding two starts per planning area closes gaps faster but increases mentor load — watch for new staggered / at-risk markets.";
      break;
    }
    case "top_20_ready": {
      const ranked = [...clone].map((m) => ({ m, p: computeRecommendation(m, rules).priority_score })).sort((a, b) => b.p - a.p);
      const keep = new Set(ranked.slice(0, 20).map((r) => r.m.id));
      clone.forEach((m) => { if (!keep.has(m.id)) m.pending_starts = 0; });
      summary = "Concentrating on the top-20 priority markets preserves most hiring volume while removing starts from lower-priority, higher-risk markets.";
      break;
    }
    case "increase_demand": {
      clone.forEach((m) => {
        ["actual_work_volume", "forecasted_demand", "forward_capacity"].forEach((f) => { if (m[f] != null) m[f] = Math.min(100, Math.round(m[f] * (1 + pct))); });
      });
      summary = `A ${Math.round(pct * 100)}% demand lift moves several Demand-First and Pipeline markets toward Ready to Hire and reduces go-live risk.`;
      break;
    }
    case "reduce_mentor": {
      clone.forEach((m) => { if (m.mentor_capacity != null) m.mentor_capacity = Math.max(0, m.mentor_capacity - 1); });
      summary = "Reducing mentor capacity by one pushes markets into Stagger Starts / Training First and raises go-live blocks.";
      break;
    }
    case "add_starts": {
      const ids = new Set((params.market_ids || []).map(Number));
      clone.forEach((m) => { if (!ids.size || ids.has(m.id)) m.pending_starts = (m.pending_starts || 0) + n; });
      summary = `Adding ${n} start(s) to ${ids.size ? "selected markets" : "every market"} increases mentor overload and may exceed safe capacity.`;
      break;
    }
    case "shift_part_time": {
      clone.forEach((m) => {
        const rec = computeRecommendation(m, rules);
        if (rec.part_time_suggested && m.forecasted_demand != null) { m.forecasted_demand = 46; m.actual_work_volume = Math.max(m.actual_work_volume || 0, 46); }
      });
      summary = "Shifting thin-forecast markets to part-time coverage removes them from the demand-support queue while still covering work.";
      break;
    }
    default:
      return res.status(400).json({ error: "Unknown scenario" });
  }

  const result = aggregate(clone, rules);
  const delta = {
    ready: result.ready - baseline.ready,
    atRisk: result.atRisk - baseline.atRisk,
    blocked: result.blocked - baseline.blocked,
    overloadStarts: result.overloadStarts - baseline.overloadStarts,
    demandNeeded: result.demandNeeded - baseline.demandNeeded,
  };
  const riskReduction = baseline.atRisk ? Math.round(((baseline.atRisk - result.atRisk) / baseline.atRisk) * 100) : 0;
  let headline = summary;
  if (scenario === "top_20_ready" && riskReduction > 0)
    headline = `The top-20-market strategy preserves most hiring volume while reducing high-risk markets by ${riskReduction}%.`;
  res.json({ scenario, params, baseline, result, delta, summary: headline });
});

/* ------------------------------ CSV I/O ---------------------------- */
router.get("/export/markets.csv", (req, res) => {
  const rows = db.prepare(`SELECT ${MARKET_CSV_COLUMNS.join(",")} FROM markets ORDER BY market`).all();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="markets.csv"');
  res.send(toCSV(rows, MARKET_CSV_COLUMNS));
});

router.get("/template/markets.csv", (req, res) => {
  const cols = MARKET_CSV_COLUMNS.filter((c) => c !== "id");
  const sample = {
    region: "West", planning_area: "Example Metro", market: "Example City", zip_cluster: "CA-900xx", skill_type: "HVAC",
    current_headcount: 8, target_headcount: 12, pending_offers: 0, pending_starts: 1, next_start_date: "", open_reqs: 2,
    actual_work_volume: 70, forecasted_demand: 68, forward_capacity: 65, mentor_capacity: 2, training_capacity: 3,
    attrition_90_days: 8, recruiter_pipeline_count: 4, market_priority: "Medium", is_union_market: 0, is_focus_market: 0,
    leadership_exception: 0, exception_reason: "", owner: "Owner Name", skill_match: 70, notes: "", last_updated: "",
  };
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="markets-template.csv"');
  res.send(toCSV([sample], cols));
});

router.post("/import/markets", (req, res) => {
  let text = "";
  if (typeof req.body === "string") text = req.body;
  else if (req.body && typeof req.body.csv === "string") text = req.body.csv;
  if (!text.trim()) return res.status(400).json({ error: "No CSV content provided." });

  let parsed;
  try { parsed = parseCSV(text); } catch (e) { return res.status(400).json({ error: "Could not parse CSV: " + e.message }); }
  if (!parsed.length) return res.status(400).json({ error: "CSV had no data rows." });
  if (parsed.length > 5000) return res.status(413).json({ error: `Too many rows (${parsed.length}); the import limit is 5000.` });

  const editable = MARKET_CSV_COLUMNS.filter((c) => c !== "id");
  let created = 0, updated = 0;
  const errors = [];
  const tx = db.transaction(() => {
    parsed.forEach((raw, idx) => {
      const data = coerceMarketRow(raw);
      if (!data.market) { errors.push(`Row ${idx + 2}: missing market`); return; }
      data.last_updated = data.last_updated || nowISO().slice(0, 10);
      const existingId = raw.id ? Number(raw.id) : null;
      const match = existingId ? db.prepare("SELECT * FROM markets WHERE id = ?").get(existingId)
        : db.prepare("SELECT * FROM markets WHERE market = ? AND skill_type = ?").get(data.market, data.skill_type || null);
      if (match) {
        const cols = Object.keys(data).filter((c) => editable.includes(c));
        db.prepare(`UPDATE markets SET ${cols.map((c) => c + " = @" + c).join(", ")} WHERE id = @id`).run({ ...data, id: match.id });
        logAudit({ entity_type: "market", entity_id: match.id, action: "import_update", new_value: data, changed_by: "csv-import", reason: "CSV import" });
        updated++;
      } else {
        const cols = Object.keys(data);
        const info = db.prepare(`INSERT INTO markets (${cols.join(",")}) VALUES (${cols.map((c) => "@" + c).join(",")})`).run(data);
        logAudit({ entity_type: "market", entity_id: info.lastInsertRowid, action: "import_create", new_value: data, changed_by: "csv-import", reason: "CSV import" });
        created++;
      }
    });
  });
  tx();
  res.json({ ok: true, created, updated, errors, total: parsed.length });
});

/* ------------------------------ audit ------------------------------ */
router.get("/audit", (req, res) => {
  const limit = Number(req.query.limit || 100);
  res.json(db.prepare("SELECT * FROM audit_log ORDER BY changed_at DESC LIMIT ?").all(limit)
    .map((c) => ({ ...c, previous_value: safeParse(c.previous_value), new_value: safeParse(c.new_value) })));
});

/* -------------------------- leadership memo ------------------------ */
router.get("/leadership-summary", (req, res) => {
  const markets = allMarketsEnriched();
  const byStatus = {};
  for (const m of markets) byStatus[m.rec.readiness_status] = (byStatus[m.rec.readiness_status] || 0) + 1;
  const atRisk = markets.filter((m) => m.rec.readiness_status === "At Risk");
  const exceptions = markets.filter((m) => m.rec.readiness_status === "Leadership Exception");
  const lines = [
    `TECHNICIAN WORKFORCE — LEADERSHIP SUMMARY (${new Date().toISOString().slice(0, 10)})`,
    "",
    `Markets evaluated: ${markets.length}`,
    `Ready to hire: ${byStatus["Ready to Hire"] || 0} · Stagger starts: ${byStatus["Stagger Starts"] || 0} · Demand-first: ${byStatus["Demand First"] || 0} · Training-first: ${byStatus["Training First"] || 0}`,
    `At risk: ${atRisk.length} · Leadership exceptions: ${exceptions.length} · Data incomplete: ${byStatus["Data Incomplete"] || 0}`,
    "",
    "Risk ownership:",
    ...atRisk.map((m) => `  • ${m.market} ${m.skill_type} — risk ${m.rec.risk_score} (${m.rec.risk_level}); owner ${m.owner}. Next: escalate before hiring continues.`),
    ...exceptions.map((m) => `  • ${m.market} ${m.skill_type} — leadership exception active. ${m.exception_reason || "Reason undocumented."}`),
    "",
    "Positioning: We are not stopping hiring. We are prioritizing hiring effort, making operational risk visible, and protecting retention before new hires are affected.",
  ];
  res.json({ text: lines.join("\n") });
});

export default router;
