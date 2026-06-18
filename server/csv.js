// Minimal, dependency-free CSV parse + stringify (RFC-4180-ish: handles quotes,
// commas and newlines inside quoted fields).

export function parseCSV(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); field = ""; row = []; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((v) => v !== "")).map((r) => {
    const obj = {};
    header.forEach((h, i) => (obj[h] = r[i] !== undefined ? r[i] : ""));
    return obj;
  });
}

function esc(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCSV(rows, columns) {
  const cols = columns || (rows.length ? Object.keys(rows[0]) : []);
  const lines = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((c) => esc(r[c])).join(","));
  return lines.join("\n");
}

export const MARKET_CSV_COLUMNS = [
  "id","region","planning_area","market","zip_cluster","skill_type",
  "current_headcount","target_headcount","pending_offers","pending_starts",
  "next_start_date","open_reqs","actual_work_volume","forecasted_demand",
  "forward_capacity","mentor_capacity","training_capacity","attrition_90_days",
  "recruiter_pipeline_count","market_priority","is_union_market","is_focus_market",
  "leadership_exception","exception_reason","owner","skill_match","notes","last_updated",
];

const INT_FIELDS = new Set([
  "current_headcount","target_headcount","pending_offers","pending_starts","open_reqs",
  "actual_work_volume","forecasted_demand","forward_capacity","mentor_capacity",
  "training_capacity","attrition_90_days","recruiter_pipeline_count","is_union_market",
  "is_focus_market","leadership_exception","skill_match",
]);

export function coerceMarketRow(obj) {
  const out = {};
  for (const col of MARKET_CSV_COLUMNS) {
    if (col === "id") continue;
    let v = obj[col];
    if (v === undefined) continue;
    if (typeof v === "string") v = v.trim();
    if (v === "" || v === null) { out[col] = null; continue; }
    if (INT_FIELDS.has(col)) {
      const n = Number(v);
      out[col] = Number.isFinite(n) ? Math.round(n) : null;
    } else out[col] = v;
  }
  return out;
}
