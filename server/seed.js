import { db, logAudit } from "./db.js";
import { DEFAULT_RULES } from "./scoring.js";

/* ------------------------------------------------------------------ */
/*  Business rules                                                     */
/* ------------------------------------------------------------------ */
export function seedRules(force = false) {
  const count = db.prepare("SELECT COUNT(*) c FROM business_rules").get().c;
  if (count > 0 && !force) return;
  const insert = db.prepare(
    `INSERT INTO business_rules (rule_name, rule_value, description, category, unit)
     VALUES (@rule_name,@rule_value,@description,@category,@unit)
     ON CONFLICT(rule_name) DO UPDATE SET rule_value=excluded.rule_value`
  );
  const tx = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
  tx(DEFAULT_RULES);
}

/**
 * Insert any rule introduced after the database was first seeded (e.g. the cost
 * assumptions) without overwriting values the customer has already tuned. Runs on
 * every boot so an existing database picks up new policy levers automatically.
 */
export function ensureRules() {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO business_rules (rule_name, rule_value, description, category, unit)
     VALUES (@rule_name,@rule_value,@description,@category,@unit)`
  );
  const tx = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
  tx(DEFAULT_RULES);
}

/** Remove rules that are no longer part of the engine (e.g. the retired cost assumptions). */
export function pruneRules() {
  const valid = new Set(DEFAULT_RULES.map((d) => d.rule_name));
  const rows = db.prepare("SELECT rule_name FROM business_rules").all();
  const del = db.prepare("DELETE FROM business_rules WHERE rule_name = ?");
  const tx = db.transaction(() => { for (const r of rows) if (!valid.has(r.rule_name)) del.run(r.rule_name); });
  tx();
}

/* ------------------------------------------------------------------ */
/*  Markets — 24 realistic markets covering every status & scenario    */
/* ------------------------------------------------------------------ */
const D = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const MARKETS = [
  // region, planning_area, market, zip_cluster, skill, hc, target, offers, starts, nextStart, openReqs, work, forecast, fwd, mentor, training, attr, pipe, priority, union, focus, exc, excReason, owner, skill_match, lastUpd, prev, notes
  ["Southeast","Tampa Bay","Tampa","FL-336xx","HVAC",12,18,1,1,D(6),4,82,80,78,3,6,8,6,"High",0,1,0,"","Marcus Hale",78,D(-2),null,"Strongest Southeast HVAC market this quarter."],
  ["Southeast","Central FL","Orlando","FL-328xx","Appliance",9,12,0,1,D(20),2,52,50,48,2,3,9,4,"Medium",0,0,0,"","Marcus Hale",68,D(-13),null,"Steady volume, keep pipeline warm."],
  ["Southeast","Metro Atlanta","Atlanta","GA-303xx","Refrigeration",10,16,0,4,D(10),3,80,76,70,1,4,10,5,"High",0,0,0,"","Priya Raman",65,D(-3),null,"Demand strong but only one mentor on the bench."],
  ["Southeast","Charlotte Metro","Charlotte","NC-282xx","Tech 1",7,11,0,1,D(25),2,24,26,22,2,3,8,3,"Medium",0,0,0,"","Priya Raman",60,D(-4),null,"Hiring need exists but board volume is soft."],
  ["Southeast","Nashville Metro","Nashville","TN-372xx","Senior Tech",8,12,0,0,null,2,76,74,70,0,2,9,4,"High",0,0,0,"","Dana Cole",72,D(-6),null,"No active mentor — must build field support first."],
  ["Southwest","DFW Metroplex","Dallas","TX-752xx","HVAC",9,15,1,3,D(5),4,22,30,28,1,2,22,5,"High",0,0,0,"","Dana Cole",50,D(-1),"Ready to Hire","Slipped from Ready to At Risk after work volume dropped."],
  ["Southwest","Greater Houston","Houston","TX-770xx","Senior Tech",10,16,0,2,D(14),3,30,34,30,1,2,18,4,"High",0,0,1,"Strategic Gulf Coast expansion — VP Field Ops accepting ramp risk through Q3.","Dana Cole",55,D(-2),null,"Leadership-directed continuation despite soft demand."],
  ["West","Front Range","Denver","CO-802xx","Appliance",8,null,0,1,null,2,40,null,null,null,2,null,3,"Medium",0,0,0,"","Sasha Lin",60,D(-58),null,"Source data incomplete — awaiting capacity refresh."],
  ["Midwest","Chicagoland","Chicago","IL-606xx","Refrigeration",11,16,0,2,D(12),3,78,74,72,2,4,11,5,"High",1,0,0,"","Sasha Lin",72,D(-3),null,"Union market — ramp friction factored into readiness."],
  ["West","Puget Sound","Seattle","WA-981xx","HVAC",10,17,1,1,D(6),5,85,82,80,3,6,7,7,"High",0,1,0,"","Sasha Lin",80,D(-1),null,"Top focus market — push aggressively."],
  ["Southwest","Phoenix Metro","Phoenix","AZ-850xx","HVAC",9,15,0,3,D(9),6,84,80,78,0,2,16,4,"High",0,0,0,"","Dana Cole",68,D(-1),null,"High demand but zero mentor capacity and req overload."],
  ["West","Las Vegas Valley","Las Vegas","NV-891xx","Tech 1",6,9,0,2,D(3),2,16,20,18,2,3,12,3,"Medium",0,0,0,"","Sasha Lin",58,D(-1),null,"Start in days but almost no board volume."],
  ["Southeast","South Florida","Miami","FL-331xx","Appliance",9,12,0,1,D(22),8,64,60,58,2,3,9,9,"Medium",0,0,0,"","Marcus Hale",66,D(-9),null,"Eight open reqs against a gap of two — clean up duplicates."],
  ["Southwest","Greater San Antonio","San Antonio","TX-782xx","Refrigeration",6,7,0,0,null,1,24,22,26,2,2,8,2,"Low",0,0,0,"","Priya Raman",62,D(-21),null,"Thin forecast — part-time may fit better than full-time."],
  ["Northeast","Greater Boston","Boston","MA-021xx","Senior Tech",12,17,1,1,D(13),3,76,72,70,3,5,9,6,"High",1,0,0,"","Owen Frost",75,D(-2),null,"Union market with strong, durable demand."],
  ["Midwest","Twin Cities","Minneapolis","MN-554xx","HVAC",10,15,0,3,D(11),3,74,70,66,1,4,12,4,"Medium",0,0,0,"","Owen Frost",68,D(-3),null,"Demand healthy but starts outpace the single mentor."],
  ["West","Portland Metro","Portland","OR-972xx","Appliance",7,10,0,1,D(26),2,50,52,48,2,3,8,4,"Medium",0,0,0,"","Sasha Lin",66,D(-19),null,"Moderate market — build pipeline."],
  ["West","Sacramento Valley","Sacramento","CA-958xx","Tech 1",6,10,0,1,D(24),2,28,30,26,2,3,8,3,"Medium",0,0,0,"","Sasha Lin",60,D(-5),null,"Need exists but demand soft — alert marketing."],
  ["Midwest","Metro Detroit","Detroit","MI-482xx","Refrigeration",12,11,0,0,null,1,55,50,50,2,3,9,2,"Low",0,0,0,"","Owen Frost",65,D(-34),null,"At target — minimal recruiter effort."],
  ["Midwest","Kansas City","Kansas City","MO-641xx","HVAC",8,13,0,1,D(8),3,80,78,74,3,5,8,5,"High",0,0,0,"","Owen Frost",76,D(-1),null,"Ready to push — capacity and demand aligned."],
  ["Midwest","Columbus Metro","Columbus","OH-432xx","Tech 1",7,11,0,2,D(6),2,58,60,55,2,2,9,4,"Medium",0,0,0,"","Owen Frost",64,D(-12),null,"Medium demand, watch go-live timing."],
  ["Southeast","Research Triangle","Raleigh","NC-276xx","Senior Tech",9,15,1,1,D(7),5,83,80,78,3,6,8,6,"High",0,1,0,"","Priya Raman",79,D(-1),null,"Focus market — durable senior demand."],
  ["West","Wasatch Front","Salt Lake City","UT-841xx","Appliance",7,11,0,1,D(18),2,72,70,66,0,0,10,3,"Medium",0,0,0,"","Sasha Lin",66,D(-3),null,"Demand exists but no mentor or training slot at all."],
  ["Midwest","Indianapolis Metro","Indianapolis","IN-462xx","HVAC",8,14,0,2,D(20),7,38,42,40,1,2,26,4,"Medium",0,0,0,"","Owen Frost",52,D(-2),null,"High attrition plus req overload pushing risk up."],
];

const MARKET_COLS = [
  "region","planning_area","market","zip_cluster","skill_type","current_headcount","target_headcount",
  "pending_offers","pending_starts","next_start_date","open_reqs","actual_work_volume","forecasted_demand",
  "forward_capacity","mentor_capacity","training_capacity","attrition_90_days","recruiter_pipeline_count",
  "market_priority","is_union_market","is_focus_market","leadership_exception","exception_reason","owner",
  "skill_match","last_updated","previous_readiness_status","notes",
];

export function seedMarkets(force = false) {
  const count = db.prepare("SELECT COUNT(*) c FROM markets").get().c;
  if (count > 0 && !force) return;
  const placeholders = MARKET_COLS.map((c) => "@" + c).join(",");
  const insert = db.prepare(
    `INSERT INTO markets (${MARKET_COLS.join(",")}) VALUES (${placeholders})`
  );
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      const obj = {};
      MARKET_COLS.forEach((c, i) => (obj[c] = r[i] === undefined ? null : r[i]));
      insert.run(obj);
    }
  });
  tx(MARKETS);
}

/* ------------------------------------------------------------------ */
/*  Workflow objects: handoffs, decisions, exceptions, audit trail     */
/* ------------------------------------------------------------------ */
function marketId(name) {
  const row = db.prepare("SELECT id FROM markets WHERE market = ?").get(name);
  return row ? row.id : null;
}

export function seedWorkflow(force = false) {
  const hc = db.prepare("SELECT COUNT(*) c FROM handoffs").get().c;
  if (hc > 0 && !force) return;
  const now = new Date().toISOString();

  const handoff = db.prepare(
    `INSERT INTO handoffs (market_id, handoff_type, owner, deadline, status, demand_gap, needed_work_volume, escalation_level, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  );
  handoff.run(marketId("Charlotte"), "Demand / Marketing", "Demand Ops — J. Portis", D(10), "Sent", 21, 40, "Level 1", "Requested local lead-gen lift before two starts land.", now, now);
  handoff.run(marketId("Las Vegas"), "Demand / Marketing", "Demand Ops — J. Portis", D(3), "At Risk", 30, 55, "Level 2", "Start in 3 days, board volume critically low. Escalated.", now, now);
  handoff.run(marketId("Sacramento"), "B2B / Commercial", "B2B Team — R. Vance", D(24), "Accepted", 25, 35, "Level 1", "B2B pipeline being built to backfill residential softness.", now, now);
  handoff.run(marketId("San Antonio"), "Demand / Marketing", "Demand Ops — J. Portis", D(15), "Not Sent", 28, 30, "Level 1", "Evaluate part-time vs demand creation.", now, now);
  handoff.run(marketId("Dallas"), "Demand / Marketing", "Demand Ops — J. Portis", D(5), "In Progress", 35, 60, "Level 3", "Critical — start imminent, demand collapsed. Daily standup.", now, now);

  const decision = db.prepare(
    `INSERT INTO decisions (market_id, decision_type, decision_summary, decided_by, decision_date, reason, outcome, review_date)
     VALUES (?,?,?,?,?,?,?,?)`
  );
  decision.run(marketId("Houston"), "Leadership Exception", "Approved continued hiring despite soft demand.", "VP Field Ops — L. Mendes", D(-8), "Strategic Gulf Coast expansion.", "Open", D(22));
  decision.run(marketId("Dallas"), "Stagger Starts", "Held two of three starts to next cohort.", "Capacity — A. Brooks", D(-3), "Mentor capacity and demand both constrained.", "In effect", D(11));
  decision.run(marketId("Atlanta"), "Stagger Starts", "Spaced four starts across three weeks.", "Capacity — A. Brooks", D(-5), "Single mentor cannot absorb four at once.", "In effect", D(16));
  decision.run(marketId("Tampa"), "Approve Aggressive Hiring", "Greenlit aggressive sourcing for HVAC.", "TA Lead — N. Shrivastava", D(-2), "Strong demand and full capacity.", "Active", D(28));

  const exc = db.prepare(
    `INSERT INTO leadership_exceptions (market_id, system_recommendation, override_status, risk_level, requested_by, approved_by, approval_date, exception_reason, risk_acknowledged, required_support_team, review_date, outcome, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  exc.run(marketId("Houston"), "Demand First", "Approved", "Medium", "RD Southwest — K. Obi", "VP Field Ops — L. Mendes", D(-8), "Strategic Gulf Coast expansion — accepting ramp risk through Q3.", 1, "Demand / Marketing", D(22), "Open", "Field leadership to staff demand creation in parallel.");

  // A couple of audit entries so "What Changed" is populated on first load
  logAudit({ entity_type: "market", entity_id: marketId("Dallas"), action: "status_change", previous_value: { readiness_status: "Ready to Hire" }, new_value: { readiness_status: "At Risk" }, changed_by: "scoring-engine", reason: "Work volume dropped below threshold." });
  logAudit({ entity_type: "handoff", entity_id: marketId("Las Vegas"), action: "escalated", previous_value: { escalation_level: "Level 1" }, new_value: { escalation_level: "Level 2" }, changed_by: "Demand Ops — J. Portis", reason: "Start date inside go-live window." });
  logAudit({ entity_type: "leadership_exception", entity_id: marketId("Houston"), action: "approved", previous_value: { override_status: "Requested" }, new_value: { override_status: "Approved" }, changed_by: "VP Field Ops — L. Mendes", reason: "Strategic expansion." });
}

/* ------------------------------------------------------------------ */
/*  Candidate funnel + technician roster (hiring & retention data)     */
/* ------------------------------------------------------------------ */
const FIRST = ["James","Maria","Devon","Aisha","Carlos","Tyler","Nina","Omar","Grace","Liam","Priya","Marcus","Elena","Jamal","Sofia","Wyatt","Hana","Diego","Ruth","Kevin","Lena","Andre","Mei","Cole","Tanya","Ivan","Rosa","Seth","Yara","Brett"];
const LAST = ["Walker","Nguyen","Ortiz","Bishop","Hayes","Romero","Patel","Sullivan","Coleman","Fischer","Reyes","Dawson","Khan","Mercer","Boyd","Vance","Abbott","Cross","Lowe","Park","Greer","Mathis","Dunn","Soto","Frye","Hahn","Lara","Webb","Knox","Pace"];
const RECRUITERS = ["A. Brooks", "J. Portis", "R. Vance", "K. Obi", "L. Tran"];
const SOURCES = ["Indeed", "FactoryFix", "Referral", "LinkedIn", "Competitor", "Job Board", "Past Applicant", "Direct"];
const MANAGERS = ["T. Okafor", "M. Ruiz", "D. Park", "S. Bauer", "H. Cole"];
const EXIT_REASONS = ["Pay", "Hours", "Workload", "Schedule", "Training", "Route quality", "Manager", "Job mismatch", "Relocation"];
const FALLOUT = ["Accepted other offer", "Unresponsive", "Failed background", "Comp mismatch", "Ghosted", "No-show on day 1"];
// Funnel stages with rough weights (early stages hold more candidates).
const STAGE_W = [
  ["Sourced", 16], ["Contacted", 11], ["Responded", 8], ["Screened", 10], ["Interviewed", 10],
  ["Offer Extended", 6], ["Offer Accepted", 8], ["Background", 5], ["Drug Test", 5], ["I-9", 3],
  ["Onboarding", 4], ["Started", 8], ["Fallout", 6],
];
const ONBOARD_STAGES = ["Offer Accepted", "Background", "Drug Test", "I-9", "Onboarding"];

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function weightedStage(r) {
  const total = STAGE_W.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [stage, w] of STAGE_W) { if ((x -= w) <= 0) return stage; }
  return "Sourced";
}

export function seedCandidates(force = false) {
  const have = db.prepare("SELECT COUNT(*) c FROM candidates").get().c;
  if (have > 0 && !force) return;
  const markets = db.prepare("SELECT id, market, planning_area, region, skill_type, market_priority FROM markets").all();
  const r = rng(20260617);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const techName = () => pick(FIRST) + " " + pick(LAST);
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO candidates (name, market_id, market, skill_type, location, recruiter, source, experience_level, stage, stage_entered, offer_accepted_date, background_status, drug_test_status, i9_status, paperwork_status, start_date, delay_reason, next_owner, fallout_reason, referred_by, created_at, updated_at)
     VALUES (@name,@market_id,@market,@skill_type,@location,@recruiter,@source,@experience_level,@stage,@stage_entered,@offer_accepted_date,@background_status,@drug_test_status,@i9_status,@paperwork_status,@start_date,@delay_reason,@next_owner,@fallout_reason,@referred_by,@created_at,@updated_at)`
  );
  const rows = [];
  for (const m of markets) {
    const base = m.market_priority === "High" ? 5 : m.market_priority === "Medium" ? 3 : 2;
    const n = base + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const stage = weightedStage(r);
      const source = pick(SOURCES);
      const c = {
        name: pick(FIRST) + " " + pick(LAST), market_id: m.id, market: m.market, skill_type: m.skill_type,
        location: `${m.planning_area}, ${m.region}`, recruiter: pick(RECRUITERS), source,
        experience_level: r() < 0.5 ? "Green" : "Experienced", stage, stage_entered: D(-Math.floor(r() * 16)),
        offer_accepted_date: null, background_status: null, drug_test_status: null, i9_status: null, paperwork_status: null,
        start_date: null, delay_reason: null, next_owner: null, fallout_reason: null,
        referred_by: source === "Referral" ? techName() : null, created_at: now, updated_at: now,
      };
      if (ONBOARD_STAGES.includes(stage)) {
        const daysAcc = 1 + Math.floor(r() * 12);
        const idx = ONBOARD_STAGES.indexOf(stage);
        c.offer_accepted_date = D(-daysAcc);
        c.background_status = idx >= 1 ? "Complete" : r() < 0.5 ? "In progress" : "Not started";
        c.drug_test_status = idx >= 2 ? "Complete" : stage === "Background" && r() < 0.4 ? "In progress" : "Not started";
        c.i9_status = idx >= 3 ? "Complete" : "Not started";
        c.paperwork_status = idx >= 4 ? "In progress" : "Not started";
        c.next_owner = pick(["Recruiter", "Onboarding", "Candidate", "Background vendor"]);
        if (daysAcc >= 5) c.delay_reason = pick(["Awaiting drug test", "Background pending", "Candidate unresponsive", "Paperwork incomplete"]);
      } else if (stage === "Started") {
        c.start_date = D(-Math.floor(r() * 20));
        c.background_status = c.drug_test_status = c.i9_status = c.paperwork_status = "Complete";
      } else if (stage === "Fallout") {
        c.fallout_reason = pick(FALLOUT);
      }
      rows.push(c);
    }
  }
  const tx = db.transaction((rs) => rs.forEach((row) => insert.run(row)));
  tx(rows);
}

export function seedTechnicians(force = false) {
  const have = db.prepare("SELECT COUNT(*) c FROM technicians").get().c;
  if (have > 0 && !force) return;
  const markets = db.prepare("SELECT id, market, skill_type, current_headcount, attrition_90_days FROM markets").all();
  const r = rng(99887766);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const insert = db.prepare(
    `INSERT INTO technicians (name, market_id, market, skill_type, experience_level, manager, hire_source, start_date, exit_date, exit_reason, exit_type)
     VALUES (@name,@market_id,@market,@skill_type,@experience_level,@manager,@hire_source,@start_date,@exit_date,@exit_reason,@exit_type)`
  );
  const rows = [];
  for (const m of markets) {
    const active = Math.max(3, m.current_headcount || 6);
    const manager = "Field — " + pick(MANAGERS);
    for (let i = 0; i < active; i++) {
      rows.push({
        name: pick(FIRST) + " " + pick(LAST), market_id: m.id, market: m.market, skill_type: m.skill_type,
        experience_level: r() < 0.35 ? "Green" : "Experienced", manager, hire_source: pick(SOURCES),
        start_date: D(-(30 + Math.floor(r() * 900))), exit_date: null, exit_reason: null, exit_type: null,
      });
    }
    const attr = m.attrition_90_days || 8;
    const exits = Math.round((attr / 100) * active * 1.6);
    for (let i = 0; i < exits; i++) {
      const tenure = r() < 0.45 ? 10 + Math.floor(r() * 80) : 120 + Math.floor(r() * 500); // ~45% early (<90d)
      const exitedAgo = Math.floor(r() * 120);
      rows.push({
        name: pick(FIRST) + " " + pick(LAST), market_id: m.id, market: m.market, skill_type: m.skill_type,
        experience_level: r() < 0.55 ? "Green" : "Experienced", manager, hire_source: pick(SOURCES),
        start_date: D(-(exitedAgo + tenure)), exit_date: D(-exitedAgo),
        exit_reason: pick(EXIT_REASONS), exit_type: r() < 0.72 ? "Voluntary" : "Involuntary",
      });
    }
  }
  const tx = db.transaction((rs) => rs.forEach((row) => insert.run(row)));
  tx(rows);
}

/* ------------------------------------------------------------------ */
/*  Planning areas + per-skill demand/capacity (HirePower-style)       */
/* ------------------------------------------------------------------ */
const PA_CITIES = ["Richmond", "Johnson City", "Akron", "Cleveland", "Dayton", "Toledo", "Columbus", "Cincinnati", "Louisville", "Lexington", "Knoxville", "Chattanooga", "Nashville", "Memphis", "Huntsville", "Birmingham", "Montgomery", "Mobile", "Jackson", "Shreveport", "Baton Rouge", "Little Rock", "Tulsa", "Wichita", "Omaha", "Des Moines", "Springfield", "Peoria", "Rockford", "Madison", "Green Bay", "Grand Rapids", "Flint", "Lansing", "Fort Wayne", "South Bend", "Erie", "Scranton", "Allentown", "Harrisburg", "Roanoke", "Greensboro", "Winston-Salem", "Durham", "Columbia", "Greenville", "Augusta", "Savannah", "Tallahassee", "Pensacola", "Gainesville", "Lakeland", "Fort Myers", "Sarasota", "Macon", "Albany", "Spokane", "Boise", "Reno", "Fresno", "Bakersfield", "Modesto", "Stockton", "Salem", "Eugene", "Tacoma"];
const PA_REGIONS = ["Northeast", "Southeast", "Midwest", "South", "Southwest", "West", "Mountain", "Pacific"];
const codeLetters = (i) => { let s = ""; i++; while (i > 0) { i--; s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26); } return s; };

export function seedPlanningAreas(force = false) {
  const have = db.prepare("SELECT COUNT(*) c FROM planning_areas").get().c;
  if (have > 0 && !force) return;
  const r = rng(13572468);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const insArea = db.prepare("INSERT INTO planning_areas (code, name, zip, region, is_union_pr) VALUES (@code,@name,@zip,@region,@is_union_pr)");
  const insMetric = db.prepare("INSERT INTO area_metrics (area_id, skill_family, d2c_rt, other_rt, d2c_vol, other_vol, in_training, open_positions) VALUES (@area_id,@skill_family,@d2c_rt,@other_rt,@d2c_vol,@other_vol,@in_training,@open_positions)");
  const bases = ["4766", "4781", "4790", "4755"];
  const tx = db.transaction(() => {
    for (let i = 0; i < 160; i++) {
      const code = bases[Math.floor(i / 40) % bases.length] + "_" + codeLetters(i % 40);
      const info = insArea.run({ code, name: pick(PA_CITIES), zip: String(10000 + Math.floor(r() * 89999)), region: pick(PA_REGIONS), is_union_pr: r() < 0.07 ? 1 : 0 });
      const aid = info.lastInsertRowid;
      insMetric.run({ area_id: aid, skill_family: "T2", d2c_rt: +(r() * 15).toFixed(2), other_rt: +(r() * 15).toFixed(2), d2c_vol: Math.floor(r() * 300), other_vol: Math.floor(r() * 200), in_training: Math.floor(r() * 3), open_positions: Math.floor(r() * 6) });
      insMetric.run({ area_id: aid, skill_family: "HVAC", d2c_rt: +(r() * 8).toFixed(2), other_rt: 0, d2c_vol: Math.floor(r() * 40), other_vol: 0, in_training: Math.floor(r() * 2), open_positions: Math.floor(r() * 3) });
      if (r() < 0.18) insMetric.run({ area_id: aid, skill_family: "T1", d2c_rt: +(r() * 5).toFixed(2), other_rt: 0, d2c_vol: Math.floor(r() * 20), other_vol: 0, in_training: 0, open_positions: Math.floor(r() * 2) });
    }
  });
  tx();
}

export function seedAll(force = false) {
  seedRules(force);
  seedMarkets(force);
  seedWorkflow(force);
  seedTechnicians(force);
  seedPlanningAreas(force);
  seedCandidates(force);
}

// Allow `npm run seed` to (re)build the database from scratch.
const isMain = process.argv[1] && process.argv[1].endsWith("seed.js");
if (isMain) {
  const force = process.argv.includes("--force");
  if (force) {
    db.exec("DELETE FROM handoffs; DELETE FROM decisions; DELETE FROM leadership_exceptions; DELETE FROM markets; DELETE FROM business_rules; DELETE FROM audit_log; DELETE FROM candidates; DELETE FROM technicians; DELETE FROM planning_areas; DELETE FROM area_metrics;");
  }
  seedAll(force);
  const n = db.prepare("SELECT COUNT(*) c FROM markets").get().c;
  console.log(`Seeded database. Markets: ${n}`);
}
