/**
 * Requisition Health & Talent Funnel — PRD §14.13.
 *
 * The execution lens: opening more requisitions is the WRONG response when the
 * existing ones aren't filling because of a recruiting-process problem (thin pipeline,
 * weak interview conversion, declined offers, pre-start fallout, or recruiter overload).
 * This engine diagnoses the failure mode per market from the candidate funnel and
 * prescribes the matching intervention instead of "open another req".
 *
 * Pure functions over the candidate roster + enriched markets. Snapshot-based rates
 * carry numerator/denominator and a low-sample flag (PRD §8.6).
 */

const STAGE_ORDER = [
  "Sourced", "Contacted", "Responded", "Screened", "Interviewed",
  "Offer Extended", "Offer Accepted", "Background", "Drug Test", "I-9", "Onboarding", "Started",
];
const idx = (stage) => STAGE_ORDER.indexOf(stage);
const reached = (stage, milestone) => idx(stage) >= idx(milestone) && idx(stage) >= 0;

export const DEFAULT_RH = {
  minSample: 5,           // below this, rates are Low Sample and don't drive a material call
  lowVolumePerSeat: 1.0,  // qualified-ish candidates per open seat
  lowI2O: 0.5,            // interview→offer
  lowOAR: 0.65,           // offer acceptance
  highFalloutRate: 0.2,   // post-acceptance fallout
  highRecruiterLoad: 26,  // active candidates one recruiter is carrying before overload
};

const DIAGNOSES = {
  volume:  { key: "volume",  label: "Low applicant volume",   intervention: "Expand sourcing channels — the pipeline is too thin to fill the seats.", tone: "sky" },
  i2o:     { key: "i2o",     label: "Low interview→offer",    intervention: "Calibrate the candidate profile / hiring bar — interviews aren't converting.", tone: "violet" },
  oar:     { key: "oar",     label: "Low offer acceptance",   intervention: "Review comp, location, schedule, or employer brand — offers are being declined.", tone: "amber" },
  fallout: { key: "fallout", label: "High pre-start fallout", intervention: "Strengthen preboarding & screening — accepted candidates aren't starting.", tone: "orange" },
  capacity:{ key: "capacity",label: "Recruiter capacity",     intervention: "Reassign or reprioritize — the recruiter is over capacity for this market.", tone: "rose" },
  healthy: { key: "healthy", label: "Healthy pipeline",       intervention: "Pipeline is converting — a genuine seat need, safe to source and hire.", tone: "emerald" },
};

function rate(n, d) { return d > 0 ? n / d : null; }

/** Funnel + failure-mode diagnosis for one market's candidates. */
export function marketReqHealth(cands, market, overloadedRecruiters, rules = DEFAULT_RH) {
  const total = cands.length;
  const interviewed = cands.filter((c) => reached(c.stage, "Interviewed")).length;
  const offered = cands.filter((c) => reached(c.stage, "Offer Extended")).length;
  const accepted = cands.filter((c) => reached(c.stage, "Offer Accepted")).length;
  const started = cands.filter((c) => c.stage === "Started").length;
  const fallout = cands.filter((c) => c.stage === "Fallout").length;
  const openReqs = market.open_reqs || 0;

  const i2o = rate(offered, interviewed);
  const oar = rate(accepted, offered);
  const falloutRate = rate(fallout, accepted + fallout);
  const perSeat = openReqs > 0 ? total / openReqs : total;
  const lowSample = total < rules.minSample;

  // Capacity only bites when the market's PRIMARY recruiter (most candidates here)
  // is the one over capacity — not just any candidate touched by an overloaded recruiter.
  const recCount = {};
  for (const cc of cands) recCount[cc.recruiter] = (recCount[cc.recruiter] || 0) + 1;
  const primaryRecruiter = Object.entries(recCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  const recruiterOverloaded = !!primaryRecruiter && overloadedRecruiters.has(primaryRecruiter);

  // Diagnose in priority order — the first binding bottleneck wins.
  let dx = DIAGNOSES.healthy;
  if (total === 0 || perSeat < rules.lowVolumePerSeat) dx = DIAGNOSES.volume;
  else if (i2o != null && i2o < rules.lowI2O) dx = DIAGNOSES.i2o;
  else if (oar != null && oar < rules.lowOAR) dx = DIAGNOSES.oar;
  else if (falloutRate != null && falloutRate > rules.highFalloutRate) dx = DIAGNOSES.fallout;
  else if (recruiterOverloaded) dx = DIAGNOSES.capacity;

  // §14.13#7 — don't open more reqs when an open req isn't filling for a process reason.
  const dontOpenMore = dx.key !== "healthy" && dx.key !== "volume" && openReqs > 0;

  return {
    id: market.id, market: market.market, skill: market.skill_type, owner: market.owner,
    open_reqs: openReqs, total, interviewed, offered, accepted, started, fallout,
    i2o, oar, fallout_rate: falloutRate, per_seat: +perSeat.toFixed(1), low_sample: lowSample,
    diagnosis: dx.label, diagnosis_key: dx.key, diagnosis_tone: dx.tone, intervention: dx.intervention,
    dont_open_more: dontOpenMore,
  };
}

function tally(arr) {
  const m = {};
  for (const x of arr) m[x] = (m[x] || 0) + 1;
  return Object.entries(m).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

/** Portfolio Requisition Health report. */
export function reqHealthReport(candidates, markets, rules = DEFAULT_RH) {
  // Recruiter workload from active (non-terminal) candidates.
  const active = candidates.filter((c) => c.stage !== "Started" && c.stage !== "Fallout");
  const load = {};
  for (const c of active) load[c.recruiter] = (load[c.recruiter] || 0) + 1;
  const recruiterLoad = Object.entries(load).map(([recruiter, count]) => ({ recruiter, count }))
    .sort((a, b) => b.count - a.count);
  const overloaded = new Set(recruiterLoad.filter((r) => r.count >= rules.highRecruiterLoad).map((r) => r.recruiter));

  const byMarketCands = {};
  for (const c of candidates) (byMarketCands[c.market] = byMarketCands[c.market] || []).push(c);

  const rows = markets
    .map((m) => marketReqHealth(byMarketCands[m.market] || [], m, overloaded, rules))
    .sort((a, b) => Number(b.dont_open_more) - Number(a.dont_open_more) || a.per_seat - b.per_seat);

  const byDiagnosis = tally(rows.map((r) => r.diagnosis));
  const summary = {
    markets: rows.length,
    dont_open_more: rows.filter((r) => r.dont_open_more).length,
    process_problems: rows.filter((r) => r.diagnosis_key !== "healthy").length,
    healthy: rows.filter((r) => r.diagnosis_key === "healthy").length,
    avg_per_seat: rows.length ? +(rows.reduce((s, r) => s + r.per_seat, 0) / rows.length).toFixed(1) : 0,
    candidates: candidates.length,
  };
  const sources = tally(candidates.map((c) => c.source || "Unknown"));
  const startsBySource = tally(candidates.filter((c) => c.stage === "Started").map((c) => c.source || "Unknown"));

  return { summary, byDiagnosis, rows, recruiterLoad, sources, startsBySource, overloaded: [...overloaded] };
}
