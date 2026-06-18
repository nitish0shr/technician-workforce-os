import { test } from "node:test";
import assert from "node:assert/strict";
import { marketReqHealth, reqHealthReport } from "./reqhealth.js";

const market = { id: 1, market: "Test", skill_type: "HVAC", owner: "X", open_reqs: 4 };
const c = (stage, recruiter = "R1") => ({ stage, recruiter, source: "Indeed", market: "Test" });
const none = new Set();

test("thin pipeline diagnoses Low applicant volume (and does NOT block opening reqs)", () => {
  const r = marketReqHealth([c("Sourced"), c("Screened")], market, none);
  assert.equal(r.diagnosis_key, "volume");
  assert.equal(r.dont_open_more, false); // volume is a sourcing gap, not a reason to withhold seats
});

test("offers declined diagnoses Low offer acceptance and blocks opening more reqs", () => {
  const cands = [
    c("Interviewed"), c("Interviewed"),
    c("Offer Extended"), c("Offer Extended"), c("Offer Extended"), c("Offer Extended"),
    c("Started"), c("Started"), // accepted + started
  ];
  const r = marketReqHealth(cands, market, none);
  assert.equal(r.diagnosis_key, "oar"); // i2o 6/8 ok, oar 2/6 ≈ 0.33 < 0.65
  assert.equal(r.dont_open_more, true);
  assert.equal(r.low_sample, false);
});

test("a converting funnel is Healthy — a genuine seat need", () => {
  const cands = [
    c("Interviewed"), c("Offer Extended"),
    c("Offer Accepted"), c("Offer Accepted"), c("Offer Accepted"),
    c("Started"), c("Started"), c("Started"),
  ];
  const r = marketReqHealth(cands, market, none);
  assert.equal(r.diagnosis_key, "healthy");
  assert.equal(r.dont_open_more, false);
});

test("recruiter overload surfaces as a capacity diagnosis", () => {
  const cands = Array.from({ length: 6 }, () => c("Sourced", "Rbusy"));
  const r = marketReqHealth(cands, { ...market, open_reqs: 2 }, new Set(["Rbusy"]));
  assert.equal(r.diagnosis_key, "capacity");
});

test("reqHealthReport rolls up diagnoses, don't-open-more, and recruiter load", () => {
  const candidates = [
    ...Array.from({ length: 30 }, () => c("Sourced", "Rbusy")), // overloads Rbusy (≥26)
  ];
  const markets = [{ ...market }];
  const rep = reqHealthReport(candidates, markets);
  assert.equal(rep.summary.markets, 1);
  assert.ok(rep.recruiterLoad[0].recruiter === "Rbusy" && rep.recruiterLoad[0].count === 30);
  assert.ok(rep.overloaded.includes("Rbusy"));
  assert.ok(Array.isArray(rep.byDiagnosis));
});
