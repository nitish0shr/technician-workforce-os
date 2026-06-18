import express from "express";
import cors from "cors";
import compression from "compression";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import api from "./api.js";
import { seedAll, ensureRules, pruneRules, seedTechnicians, seedPlanningAreas } from "./seed.js";
import { db } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === "production";

// Auto-seed on first boot so the app "just works" on Replit with no extra steps.
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

const app = express();
// CORS is open by default for local dev (single-port prod is same-origin); lock it down
// with CORS_ORIGIN="https://app.example.com" once the app is deployed behind auth.
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true }));
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.text({ type: ["text/csv", "text/plain"], limit: "4mb" }));

// Lightweight in-memory rate limit (per IP, fixed window) so one client can't hammer
// the API. Generous for a dashboard; blocks abuse. Tune with RL_MAX / RL_WINDOW_MS.
const RL_WINDOW_MS = Number(process.env.RL_WINDOW_MS) || 60_000;
const RL_MAX = Number(process.env.RL_MAX) || 600;
const rlHits = new Map();
app.use("/api", (req, res, next) => {
  const now = Date.now();
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  let e = rlHits.get(ip);
  if (!e || now > e.reset) { e = { count: 0, reset: now + RL_WINDOW_MS }; rlHits.set(ip, e); }
  e.count++;
  if (rlHits.size > 5000) for (const [k, v] of rlHits) if (now > v.reset) rlHits.delete(k); // opportunistic cleanup
  if (e.count > RL_MAX) {
    res.set("Retry-After", String(Math.ceil((e.reset - now) / 1000)));
    return res.status(429).json({ error: "Too many requests — slow down." });
  }
  next();
});

app.use("/api", api);

// Serve the built client in production; SPA fallback for client-side routing.
const distDir = path.join(ROOT, "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
} else {
  app.get("/", (req, res) =>
    res.type("html").send(
      `<pre style="font-family:ui-monospace;padding:24px;line-height:1.5">
Technician Workforce OS — API is running on port ${PORT}.

The client has not been built yet.
  • Development:  npm run dev      (Vite on :5173 proxies /api here)
  • Production:   npm run build && npm start

API health: <a href="/api/health">/api/health</a>
</pre>`
    )
  );
}

app.use((err, req, res, next) => {
  // Always log the full error server-side; never leak internals to the client in prod.
  console.error("[workforce-os] error:", err);
  res.status(err.status || 500).json({ error: isProd ? "Internal error" : err.message || "Internal error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[workforce-os] ${isProd ? "production" : "api"} server on http://0.0.0.0:${PORT}`);
});
