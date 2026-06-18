import { db } from "./db.js";
import { computeRecommendation, generateAlerts, rulesToMap } from "./scoring.js";

export function getRulesMap() {
  const rows = db.prepare("SELECT rule_name, rule_value FROM business_rules").all();
  return rulesToMap(rows);
}

/** Market row -> { ...market, rec, alerts } using current rules. */
export function enrich(market, rules = getRulesMap()) {
  const rec = computeRecommendation(market, rules);
  const alerts = generateAlerts(market, rules, rec);
  return { ...market, rec, alerts };
}

export function allMarketsEnriched(rulesOverride) {
  const rules = rulesOverride || getRulesMap();
  const rows = db.prepare("SELECT * FROM markets ORDER BY market").all();
  return rows.map((m) => enrich(m, rules));
}

export function marketById(id, rulesOverride) {
  const rules = rulesOverride || getRulesMap();
  const m = db.prepare("SELECT * FROM markets WHERE id = ?").get(id);
  if (!m) return null;
  return enrich(m, rules);
}
