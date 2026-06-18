# Technician Workforce OS

**A technician hiring-decision tool for field service.** It answers one thing clearly for the
recruitment team: **where do we need people, and where do we pause or stop hiring** — using
**demand vs. supply** by planning area and market, with **technician retention** as a pause
signal. It deliberately ignores recruiter productivity, sourcing channels, and the candidate
funnel — those don't change *where* to hire.

It answers: **(1)** where should we hire, **(2)** where should we pause or stop, **(3)** where
is demand high but technician supply low, and **(4)** where high attrition means *fix
retention before hiring more*.

> **Demand vs. supply is the spine.** Where demand outpaces supply, concentrate hiring. Where
> the field can't yet absorb new technicians, fix capacity first. Where supply already meets
> demand, hold. Retention sits on top: a market with high demand *and* high attrition isn't a
> "hire more" problem — the platform says investigate first.

> **Every screen leads to an action** — hire here, pause here, follow up with these
> candidates, fix this onboarding blocker, investigate this retention problem, shift sourcing
> effort here.

---

## 1. What it answers

1. **Where should we hire?** — Market Readiness scoring and the Command Center priority queue.
2. **How aggressively should we hire?** — Hiring mode (Aggressive → Hold) per market.
3. **Can the field train and support the hire?** — Training status from mentor and training capacity.
4. **Will the technician have enough work after go-live?** — Demand status and Go-Live status.
5. **Who owns the risk if hiring continues?** — Risk queue, owners, and Leadership Exceptions.
6. **Where does demand outpace supply?** — The Demand & Supply view: every market classified as Understaffed, Capacity-blocked, Demand-soft, or Supply-met, ranked by the unfilled gap.
7. **What should happen next?** — A plain-English recommended action and required next steps for every market.

---

## 2. How to run the app

### Option A — Replit (recommended, zero config)

1. Import this repository into a new Replit (Node template) or open the included `.replit`.
2. Press **Run**. The configured command is:

   ```
   npm install && npm run build && npm start
   ```

3. The app boots on the single port Replit exposes. On first boot the database is
   **auto-seeded** with 24 realistic markets — no extra steps.

No API keys, no external services, and **no native compilation** are required. The
database is SQLite via `sql.js` (WebAssembly), bundled in the package.

### Option B — Local development (hot reload)

```bash
npm install
npm run dev
```

- `npm run dev` runs the Express API (`localhost:3001`) and the Vite client
  (`localhost:5173`) together. Vite proxies `/api` to the API server.
- Open **http://localhost:5173**.

### Option C — Local production build

```bash
npm install
npm run build      # builds the client into /dist (Vite)
npm start          # Express serves the API + the built client on one port (default 3001)
```

**No-Vite fallback build.** On runtimes where `vite build` can't load rollup's native
addon (e.g. an Electron-bundled Node), use the dependency-light builder instead — it
bundles the client with the standalone esbuild binary and compiles Tailwind with its CLI,
producing the same `/dist`:

```bash
npm run build:desktop
npm start
```

### Useful scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | API + client with hot reload |
| `npm run build` | Build the client to `/dist` |
| `npm start` | Production server (serves API + `/dist`) |
| `npm run seed` | Seed the database if empty |
| `npm run seed -- --force` | Wipe and re-seed from scratch |

The database file lives at `server/data/workforce.sqlite` and persists across restarts.
Delete it (or run `npm run seed -- --force`) to reset to the seed data.

---

## 3. Product overview

Technician Workforce OS is organised as a left-sidebar command center with ten surfaces:

| Page | Purpose |
| --- | --- |
| **Command Center** | Daily cockpit: today's workforce signal (led by where demand outpaces supply), Push Now / At Risk / Starts in 7 days / Needs Decision, recommended-action and risk-level distributions, top-priority markets, risk queue, decision queue, what changed, and the weekly leadership memo. |
| **Demand & Supply** | The balance view: how many markets have demand outpacing supply vs. supply meeting demand, the understaffed markets ranked by their unfilled gap (with a diverging gap bar), the demand mix (High / Medium / Low), and the breakdown by balance state. Includes a one-click summary. |
| **Market Readiness** | Split-view: a sortable/filterable market list on the left and a full recommendation panel on the right (recommendation, why, evidence, alerts, handoffs, exception status, decision history, raw data). |
| **Recruiter Focus** | Simple, recruiter-friendly action buckets: Push Today, Build Pipeline, Stagger Starts, Low Focus, Escalate Before Moving — each with candidate *profile guidance* (never candidate scoring). |
| **Start Readiness** | Upcoming starts in the next 7 / 14 / 30 days with Go-Live status, explanation, and the action needed. |
| **Demand Handoffs** | Create, escalate, and close demand/marketing/B2B support requests with an owner and deadline. |
| **Leadership Decisions** | Track leadership exceptions: who requested, who approved, risk acknowledged, support team, review date, and outcome — so it is explicit when hiring continues despite risk. |
| **Scenario Lab** | Model hiring strategies (hire 2 per area, top-20 markets, demand lifts, mentor cuts, added starts, part-time shift) and see the impact before committing. |
| **Data Health** | Completeness and confidence per market: data health score, missing fields, stale fields, last updated, and source of truth. |
| **Operating Rules** | Admin thresholds that drive every recommendation. Editing a rule re-scores all markets immediately. |

---

## 4. User roles

The product is built for the cross-functional group that decides technician hiring:

- **Talent Acquisition / Recruiting** — lives in Recruiter Focus and Market Readiness; decides where to spend sourcing effort.
- **Capacity Planning** — owns Market Readiness, Scenario Lab, and Operating Rules; sets thresholds and models trade-offs.
- **Training / Field Ops** — owns Start Readiness and mentor/training capacity inputs; confirms the field can support starts.
- **Demand / Marketing / B2B** — owns Demand Handoffs; creates work before starts land.
- **Executive Leadership** — owns Leadership Decisions; accepts and documents risk via exceptions, and reads the weekly memo.

Roles are conceptual in this build (no login). Owners are attached to every market, risk,
handoff, and decision so accountability is always visible.

---

## 5. Data model

SQLite tables (see `server/db.js`):

- **markets** — the core object. Region, planning area, market, zip cluster, skill type, current/target headcount, pending offers/starts, next start date, open reqs, actual work volume, forecasted demand, forward capacity, mentor capacity, training capacity, 90-day attrition, recruiter pipeline, market priority, union/focus flags, leadership exception flag + reason, owner, notes, skill match, last updated.
- **recommendations** — derived recommendation fields (defined for completeness; computed live at read time so they never go stale).
- **signals** / **risks** — informational signals and owned, actionable risks (generated by the engine).
- **decisions** — decision log per market (stagger, approve, alert-resolved, etc.).
- **handoffs** — demand/marketing/B2B support requests with status and escalation level.
- **leadership_exceptions** — overrides with requester, approver, risk acknowledgement, support team, review date, outcome.
- **audit_log** — every create/update/status-change with previous/new value, who, when, and why.
- **business_rules** — editable thresholds.

**Design note:** markets and the workflow objects (handoffs, decisions, leadership
exceptions, business rules, audit log) are persisted. Recommendations, signals, and risks
are **derived from market data on every read** by the scoring engine, so a change to a
market — or to a business rule — instantly and consistently updates every recommendation,
score, alert, and queue across the app.

---

## 6. Recommendation logic

All logic lives in `server/scoring.js` as pure functions. Inputs are a market row and the
current business rules.

### Adjusted staffing gap
```
gap = target_headcount − current_headcount − pending_starts − pending_offers
```

### Demand status
Take the strongest of `actual_work_volume`, `forecasted_demand`, `forward_capacity`
(treated as 0–100 indices):
- **High** ≥ `high_demand_threshold` (default 70)
- **Medium** ≥ `medium_demand_threshold` (default 45)
- **Low** below that, **Unknown** if all are missing.

### Training status
Each mentor can safely support `max_pending_starts_per_mentor` starts (default 2):
- **Ready** — mentor support and training slots both cover pending starts.
- **Limited** — some capacity, but not enough.
- **Not Ready** — zero mentor or zero training capacity.
- **Unknown** — capacity data missing.

### Scores (0–100)
- **Market Readiness** — blends gap, demand health, forecast, forward capacity, mentor and training adequacy, skill match, pending-start load (penalty), focus boost, union adjustment, and data confidence.
- **Priority** — staffing gap (≤25) + forecast demand (≤20) + work volume (≤15) + forward capacity (≤15) + attrition/backfill (≤10) + leadership/focus (≤10) + recruiter pipeline (≤5).
- **Risk** — low work volume (≤25) + starts > mentor capacity (≤20) + thin mentor bench (≤20) + open reqs > gap (≤10) + high attrition (≤10) + skill mismatch (≤10) + missing data (≤5).
- **Confidence** — 70% data completeness + 30% freshness (days since last update).

### Readiness status (decision tree, in order)
1. **Data Incomplete** — critical fields missing.
2. **Leadership Exception** — `leadership_exception = true`.
3. **Hold** — gap ≤ 0.
4. **At Risk** — risk level High or Critical.
5. **Training First** — training not ready.
6. **Demand First** — gap > 0 but demand Low.
7. **Pipeline Only** — gap > 0 and demand Medium.
8. **Stagger Starts** — demand High but training Limited or starts exceed mentor capacity.
9. **Ready to Hire** — gap > 0, demand High, training Ready, risk Low/Medium.

### Hiring mode & recommended action
Each status maps to a hiring mode (Aggressive, Balanced, Pipeline, Staggered, Demand-Led,
Training-Led, Exception, Hold) and a plain-English recommended action (e.g. "Source
aggressively", "Alert demand/marketing before additional starts").

### Go-Live status (Start Readiness)
- **Blocked** — start inside the go-live window with low work, starts exceed mentor capacity, or no mentor/training.
- **Watch** — demand only Medium or training Limited.
- **Ready** — strong demand, mentor capacity available, training in place.
- **Unknown** — critical capacity data missing.

### Explanations & alerts
Every recommendation generates a plain-English explanation. The engine also raises
**signals** (informational) and **risks** (owned, with a next step) when, for example,
demand is low with pending starts, training is not ready, starts exceed mentor capacity,
open reqs overload the gap, risk ≥ 50, a start is imminent with low work, data is missing,
an exception lacks a reason, or a market regresses from Ready to Hire to At Risk.

### Demand & supply balance
Each recommendation carries a `demand_supply_state` derived from the same inputs
(`demandSupplyState`), classifying the market against the demand-vs-supply balance:
- **Understaffed** — demand exists and there is an unfilled gap → add supply.
- **Capacity-blocked** — demand and a gap exist, but the field can't absorb new technicians yet.
- **Demand-soft** — a gap exists but demand doesn't justify adding supply.
- **Supply-met** — at or above target; supply already meets demand.

The Demand & Supply view aggregates these states and ranks the understaffed markets by the
size of the unfilled gap (supply shortfall), so the most acute demand/supply imbalances
surface first.

### Trust & data integrity
The engine is built to survive a skeptical operator asking "why should I trust this
number?":
- **No silent fake data.** Missing work volume raises risk (it is no longer defaulted to a
  "safe" 55); an unknown skill match is never invented as a neutral 60.
- **Honest confidence.** Freshness keeps decaying past 60 days and confidence is capped for
  records older than 90 days — stale data can no longer read as 79% confident.
- **No cross-surface contradictions.** A rosy forecast cannot declare "High" demand when
  there is no real work on the board, so a market is never "Ready to Hire" and "Go-Live
  Blocked" at once. Sharply disagreeing demand signals are flagged as a conflict.
- **Score provenance.** Risk, priority, and readiness each return a point-by-point
  contribution breakdown ("Why these scores?") surfaced in the market drawer.
- **Visible conflicts & reference-only data.** A market that is high-priority *and* at-risk
  is flagged for reconciliation; a Data-Incomplete or very-low-confidence market is labelled
  *reference only*.
- **Pinned behaviour.** `server/scoring.test.js` locks these guarantees with the built-in
  Node test runner (`npm test`).

---

## 7. Editing business rules

Open **Operating Rules**. Every threshold is editable inline (grouped by Demand,
Readiness, Risk, Capacity, Go-Live, Priority, Governance). Change a value and press
**Save** — all markets re-score immediately and the change is written to the audit log.
**Reset to defaults** restores the shipped values. Rules are stored in the
`business_rules` table and applied by the engine on every read, so the whole product stays
consistent with the current policy.

---

## 8. Import / export CSV

- **Export markets** — Market Readiness or Data Health → *Export CSV* (`/api/export/markets.csv`).
- **Export recruiter focus** — Recruiter Focus → *Export recruiter focus list*.
- **Download a template** — Market Readiness → *Import CSV* → *Download template* (`/api/template/markets.csv`).
- **Import** — Market Readiness → *Import CSV*. Upload a file or paste CSV text. Rows are
  matched by `id`, or by `market` + `skill_type`; existing markets are **updated** and new
  ones are **created**. Everything recomputes automatically and each row is audited.

The importer is dependency-free and handles quoted fields, commas, and newlines.

---

## 9. Future integration path

Today the app is self-contained with seed data. The data model is intentionally shaped so
real systems can feed it without UI changes — each integration simply writes to (or syncs)
the `markets` table and the workflow objects:

- **ATS (Greenhouse, Workday Recruiting, iCIMS)** — sync `open_reqs`, `pending_offers`,
  `pending_starts`, `next_start_date`, and `recruiter_pipeline_count` per market. (Market
  counts only — never candidate-level scoring.)
- **HRIS (Workday, UKG, ADP)** — sync `current_headcount`, `target_headcount`,
  `attrition_90_days`, and union flags as the source of truth for headcount.
- **Service Power API (or other dispatch/field systems)** — feed `actual_work_volume`,
  `forecasted_demand`, and `forward_capacity` from real job and capacity data so Demand and
  Go-Live status reflect the field.
- **Monday board (or Asana/Jira)** — two-way sync Demand Handoffs and Leadership Decisions
  so cross-functional work lives where teams already operate.
- **Demand / Marketing systems (HubSpot, Marketo, lead-gen platforms)** — close the loop on
  handoffs: when a demand campaign is launched and lead volume rises, push it back into
  `forecasted_demand`.
- **Analytics / forecasting models (Snowflake, Databricks, BigQuery)** — replace the seed
  forecasts with model outputs for `forecasted_demand` and `forward_capacity`, and stream
  scoring results back to the warehouse for reporting.

A practical sequence: (1) HRIS + ATS for headcount and reqs, (2) Service Power for work
volume and forecast, (3) Monday for handoff/decision sync, (4) analytics models for
forward-looking demand. Each step raises Data Health confidence without changing the
product surface.

---

## 10. Positioning for leadership

> **We are not stopping hiring. We are prioritizing hiring effort, making operational risk
> visible, and protecting retention before new hires are affected.**

The product is designed to *protect* hiring momentum: it concentrates effort where markets
are ready, surfaces risk early with a named owner, and documents the cases where leadership
chooses to continue anyway — so the organisation hires with eyes open rather than slowing
down.

---

## 11. Tech stack

- **Frontend:** React + Vite + TypeScript, Tailwind CSS, custom component system, Lucide icons, Recharts, TanStack Table.
- **Backend:** Node.js + Express.
- **Database:** SQLite via `sql.js` (WebAssembly — no native build, no network). Writes are
  **atomic and durable** (temp file → `fsync` → rename, with a previous-good `.bak`
  snapshot) so a crash mid-write can never corrupt the database.
- **Tests:** `npm test` runs the scoring-engine regression suite on the built-in Node test
  runner — no extra toolchain.
- **Hardening:** per-IP rate limiting (`RL_MAX` / `RL_WINDOW_MS`), rule-value validation,
  CSV import row caps, a DB-probing health check, configurable CORS (`CORS_ORIGIN`), and no
  internal error leakage in production.
- **UI:** a light, soft-neutral premium-SaaS theme; responsive across desktop / tablet /
  mobile (collapsible sidebar, stacking grids, horizontally-scrollable tables); keyboard-
  operable tables, a fully keyboard-driven ⌘K palette, focus rings, and `aria` dialogs.
- **Single-port production server** serves both the API and the built client (Replit-friendly).
- **No-Vite build fallback** (`npm run build:desktop`) for runtimes that can't load rollup's
  native addon — bundles with the esbuild binary + the Tailwind CLI.

### Project structure
```
technician-workforce-os/
├── server/
│   ├── index.js        # Express app, static serving, auto-seed
│   ├── api.js          # All REST endpoints
│   ├── db.js           # SQLite (sql.js) adapter + schema
│   ├── scoring.js      # Scoring engine + demand/supply lens (pure functions)
│   ├── scoring.test.js # Regression suite (node --test)
│   ├── compute.js      # Enrich markets with recommendations + alerts
│   ├── csv.js          # CSV parse / stringify
│   └── seed.js         # 24-market seed + workflow data
├── src/
│   ├── pages/          # The 10 pages (incl. Demand & Supply)
│   ├── components/      # Sidebar, CommandBar, MarketDetail, DataTable, primitives…
│   └── lib/            # api client, types, hooks, status colours, formatting
├── .replit             # Replit run config
└── package.json
```
