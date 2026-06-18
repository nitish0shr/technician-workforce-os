export interface Rec {
  market_id: number;
  adjusted_staffing_gap: number | null;
  demand_status: string;
  demand_score: number | null;
  training_status: string;
  mentor_support: number | null;
  market_readiness_score: number;
  priority_score: number;
  risk_score: number;
  risk_drivers: string[];
  confidence_score: number;
  risk_level: string;
  readiness_status: string;
  hiring_mode: string;
  recommended_action: string;
  go_live_status: string;
  go_live_explanation: string;
  days_until_start: number | null;
  part_time_suggested: boolean;
  missing_fields: string[];
  stale_fields: string[];
  explanation: string;
  calculated_at: string;
  demand_conflict: boolean;
  status_conflict: boolean;
  reference_only: boolean;
  demand_supply_state: string;
  contributions: { risk: ScoreContribution[]; priority: ScoreContribution[]; readiness: ScoreContribution[] };
}

export interface ScoreContribution { factor: string; points: number; }

export interface Alert {
  scope: "signal" | "risk";
  risk_type?: string;
  signal_type?: string;
  severity: string;
  explanation: string;
  owner: string;
  next_step: string;
}

export interface Market {
  id: number;
  region: string;
  planning_area: string;
  market: string;
  zip_cluster: string;
  skill_type: string;
  current_headcount: number | null;
  target_headcount: number | null;
  pending_offers: number | null;
  pending_starts: number | null;
  next_start_date: string | null;
  open_reqs: number | null;
  actual_work_volume: number | null;
  forecasted_demand: number | null;
  forward_capacity: number | null;
  mentor_capacity: number | null;
  training_capacity: number | null;
  attrition_90_days: number | null;
  recruiter_pipeline_count: number | null;
  market_priority: string | null;
  is_union_market: number;
  is_focus_market: number;
  leadership_exception: number;
  exception_reason: string | null;
  owner: string | null;
  notes: string | null;
  skill_match: number | null;
  previous_readiness_status: string | null;
  last_updated: string | null;
  rec: Rec;
  alerts: Alert[];
  handoffs?: any[];
  decisions?: any[];
  exception?: any;
  audit?: any[];
}

export interface Rule {
  id: number;
  rule_name: string;
  rule_value: number;
  description: string;
  category: string;
  unit: string;
}

export interface DemandSupplyRow {
  id: number;
  market: string;
  skill: string;
  planning_area: string;
  owner: string | null;
  state: string;            // Understaffed | Capacity-blocked | Demand-soft | Supply-met | Unknown
  demand_status: string;
  demand_score: number | null;
  gap: number | null;       // supply shortfall: + = need supply, − = over-supplied
  current_headcount: number | null;
  target_headcount: number | null;
  pending_starts: number | null;
  mentor_capacity: number | null;
  training_status: string;
  go_live_status: string;
  readiness_status: string;
  recommended_action: string;
  recruiter_pipeline: number | null;
}

export interface DemandSupplyReport {
  generated_at: string;
  totals: { understaffed: number; capacity_blocked: number; demand_soft: number; supply_met: number };
  byState: Record<string, number>;
  byDemand: { level: string; count: number }[];
  understaffed: DemandSupplyRow[];
  supplyLed: DemandSupplyRow[];
  all: DemandSupplyRow[];
}
