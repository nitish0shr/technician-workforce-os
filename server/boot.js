// Cold-start seeding shared by the long-running server (server/index.js) and the
// Vercel serverless entry (api/index.js). Idempotent and safe to call repeatedly:
// it only seeds an empty database and otherwise just reconciles the rule set.
import { seedAll, ensureRules, pruneRules, seedTechnicians, seedPlanningAreas } from "./seed.js";
import { db } from "./db.js";

let booted = false;

export function boot() {
  if (booted) return;
  booted = true;
  try {
    const count = db.prepare("SELECT COUNT(*) c FROM markets").get().c;
    if (count === 0) {
      seedAll();
      console.log("[workforce-os] Database empty — seeded sample markets.");
    }
    ensureRules(); // pick up any rules added since the DB was first seeded
    pruneRules();  // drop retired rules (e.g. the old cost assumptions)
    seedTechnicians();   // technician roster for retention
    seedPlanningAreas(); // planning-area requisition-planning data if empty
  } catch (e) {
    console.error("[workforce-os] Seed check failed:", e.message);
  }
}
