import initSqlJs from "sql.js";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

/**
 * Data layer.
 *
 * Uses sql.js (SQLite compiled to WebAssembly). This is a real SQLite engine
 * with zero native compilation and no network dependency, so the app installs
 * and runs identically on Replit, locally, and in CI. The database is held in
 * memory and persisted to disk (server/data/workforce.sqlite) after every
 * write, so data survives restarts.
 *
 * A small adapter below exposes the same surface as better-sqlite3
 * (db.prepare(...).run/get/all, db.exec, db.transaction, db.pragma) so the rest
 * of the codebase is storage-agnostic.
 */

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Serverless hosts (Vercel/Lambda) mount the app code read-only — only the system
// temp dir is writable. Detect that and persist there so boot never crashes; the
// dashboard is read-only seed data, so an ephemeral /tmp copy per cold start is fine.
const READONLY_FS = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION);
const DATA_DIR = READONLY_FS ? path.join(os.tmpdir(), "workforce-data") : path.join(__dirname, "data");
try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
const DB_PATH = path.join(DATA_DIR, "workforce.sqlite");

const SQL = await initSqlJs({ locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm") });
const raw = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();

let suspend = 0;
let backedUp = false;
function persist() {
  if (suspend > 0) return;
  try {
    const data = Buffer.from(raw.export());
    // Keep one previous-good snapshot the first time we write each boot, so a corrupt
    // latest file is always recoverable.
    if (!backedUp && fs.existsSync(DB_PATH)) {
      try { fs.copyFileSync(DB_PATH, DB_PATH + ".bak"); } catch {}
      backedUp = true;
    }
    // Write to a temp file, flush to disk, then atomically rename over the live DB.
    // A crash mid-write can therefore never leave a torn or zero-length database.
    const tmp = DB_PATH + ".tmp";
    const fd = fs.openSync(tmp, "w");
    try { fs.writeSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, DB_PATH);
  } catch (e) {
    console.error("[db] persist failed:", e.message);
  }
}

function bind(stmt, args) {
  if (!args || args.length === 0) return;
  let params;
  if (args.length === 1 && args[0] && typeof args[0] === "object" && !Array.isArray(args[0])) {
    params = {};
    for (const [k, v] of Object.entries(args[0])) params["@" + k] = v === undefined ? null : v;
  } else {
    params = args.map((v) => (v === undefined ? null : v));
  }
  stmt.bind(params);
}

class Stmt {
  constructor(sql) { this.sql = sql; }
  run(...args) {
    const s = raw.prepare(this.sql);
    try { bind(s, args); s.step(); } finally { s.free(); }
    persist();
    let id = 0;
    try { id = raw.exec("SELECT last_insert_rowid() AS id")[0]?.values?.[0]?.[0] ?? 0; } catch {}
    return { lastInsertRowid: id, changes: raw.getRowsModified() };
  }
  get(...args) {
    const s = raw.prepare(this.sql);
    try { bind(s, args); return s.step() ? s.getAsObject() : undefined; }
    finally { s.free(); }
  }
  all(...args) {
    const s = raw.prepare(this.sql);
    const out = [];
    try { bind(s, args); while (s.step()) out.push(s.getAsObject()); }
    finally { s.free(); }
    return out;
  }
}

export const db = {
  prepare(sql) { return new Stmt(sql); },
  exec(sql) { raw.run(sql); persist(); return this; },
  pragma() { /* WAL / foreign_keys are no-ops under sql.js */ },
  transaction(fn) {
    return (...a) => {
      suspend++;
      try {
        raw.run("BEGIN");
        const r = fn(...a);
        raw.run("COMMIT");
        return r;
      } catch (e) {
        try { raw.run("ROLLBACK"); } catch {}
        throw e;
      } finally {
        suspend--;
        persist();
      }
    };
  },
};

/* ----------------------------- schema ----------------------------- */
db.exec(`
CREATE TABLE IF NOT EXISTS markets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region TEXT,
  planning_area TEXT,
  market TEXT NOT NULL,
  zip_cluster TEXT,
  skill_type TEXT,
  current_headcount INTEGER,
  target_headcount INTEGER,
  pending_offers INTEGER,
  pending_starts INTEGER,
  next_start_date TEXT,
  open_reqs INTEGER,
  actual_work_volume INTEGER,
  forecasted_demand INTEGER,
  forward_capacity INTEGER,
  mentor_capacity INTEGER,
  training_capacity INTEGER,
  attrition_90_days INTEGER,
  recruiter_pipeline_count INTEGER,
  market_priority TEXT,
  is_union_market INTEGER DEFAULT 0,
  is_focus_market INTEGER DEFAULT 0,
  leadership_exception INTEGER DEFAULT 0,
  exception_reason TEXT,
  owner TEXT,
  notes TEXT,
  skill_match INTEGER,
  previous_readiness_status TEXT,
  last_updated TEXT
);

CREATE TABLE IF NOT EXISTS recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id INTEGER, adjusted_staffing_gap INTEGER, demand_status TEXT, training_status TEXT,
  market_readiness_score INTEGER, priority_score INTEGER, risk_score INTEGER, confidence_score INTEGER,
  risk_level TEXT, readiness_status TEXT, hiring_mode TEXT, recommended_action TEXT, explanation TEXT,
  go_live_status TEXT, go_live_explanation TEXT, calculated_at TEXT
);

CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id INTEGER, signal_type TEXT, signal_summary TEXT, severity TEXT, created_at TEXT
);

CREATE TABLE IF NOT EXISTS risks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id INTEGER, risk_type TEXT, severity TEXT, explanation TEXT, owner TEXT, status TEXT,
  created_at TEXT, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id INTEGER, decision_type TEXT, decision_summary TEXT, decided_by TEXT, decision_date TEXT,
  reason TEXT, outcome TEXT, review_date TEXT
);

CREATE TABLE IF NOT EXISTS handoffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id INTEGER, handoff_type TEXT, owner TEXT, deadline TEXT, status TEXT,
  demand_gap INTEGER, needed_work_volume INTEGER, escalation_level TEXT, notes TEXT,
  created_at TEXT, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS leadership_exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id INTEGER, system_recommendation TEXT, override_status TEXT, risk_level TEXT,
  requested_by TEXT, approved_by TEXT, approval_date TEXT, exception_reason TEXT,
  risk_acknowledged INTEGER DEFAULT 0, required_support_team TEXT, review_date TEXT, outcome TEXT, notes TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT, entity_id INTEGER, action TEXT, previous_value TEXT, new_value TEXT,
  changed_by TEXT, changed_at TEXT, reason TEXT
);

CREATE TABLE IF NOT EXISTS business_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT UNIQUE, rule_value REAL, description TEXT, category TEXT, unit TEXT
);

-- Candidate funnel + post-offer onboarding (one row per candidate-in-process).
CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, market_id INTEGER, market TEXT, skill_type TEXT, location TEXT,
  recruiter TEXT, source TEXT, experience_level TEXT,           -- Green | Experienced
  stage TEXT, stage_entered TEXT,                               -- current funnel stage + date entered
  offer_accepted_date TEXT,
  background_status TEXT, drug_test_status TEXT, i9_status TEXT, paperwork_status TEXT,
  start_date TEXT, delay_reason TEXT, next_owner TEXT, fallout_reason TEXT,
  referred_by TEXT, created_at TEXT, updated_at TEXT
);

-- Technician roster for retention / attrition (active + exited).
CREATE TABLE IF NOT EXISTS technicians (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, market_id INTEGER, market TEXT, skill_type TEXT, experience_level TEXT,
  manager TEXT, hire_source TEXT, start_date TEXT,
  exit_date TEXT, exit_reason TEXT, exit_type TEXT               -- exit_date NULL = active
);

-- Planning areas at zip granularity (HirePower-style requisition planning).
CREATE TABLE IF NOT EXISTS planning_areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT, name TEXT, zip TEXT, region TEXT, is_union_pr INTEGER DEFAULT 0
);

-- Per-area, per-skill-family demand + capacity. One row per (area, skill_family).
-- RT = run-time/utilization index; Vol = job volume; split by channel (D2C vs Other/B2B).
CREATE TABLE IF NOT EXISTS area_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_id INTEGER, skill_family TEXT,                            -- T2 | HVAC | T1 | 1099
  d2c_rt REAL, other_rt REAL, d2c_vol INTEGER, other_vol INTEGER,
  in_training INTEGER, open_positions INTEGER
);
`);

export function logAudit({
  entity_type, entity_id, action, previous_value, new_value, changed_by = "system", reason = "",
}) {
  db.prepare(
    `INSERT INTO audit_log (entity_type, entity_id, action, previous_value, new_value, changed_by, changed_at, reason)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    entity_type,
    entity_id ?? null,
    action,
    previous_value ? JSON.stringify(previous_value) : null,
    new_value ? JSON.stringify(new_value) : null,
    changed_by,
    new Date().toISOString(),
    reason
  );
}

export default db;
