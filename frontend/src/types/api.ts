/**
 * Typed API Schema for Recur Frontend matching FastAPI OpenAPI backend.
 */

export type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type IncidentStatus = "OPEN" | "INVESTIGATING" | "RESOLVED";

export interface MatchedIncident {
  id: string;
  similarity: number;
  why: string;
}

export interface AvoidStep {
  step: string;
  reason: string;
  source_incident: string;
}

export interface IncidentAnalysis {
  diagnosis: string;
  confidence: number;
  matched_incidents: MatchedIncident[];
  recommended_steps: string[];
  avoid: AvoidStep[];
  estimated_minutes: number;
  runbook: string;
  reasoning: string;
}

export interface FailedAttempt {
  step: string;
  reason: string;
}

export interface Incident {
  id: string;
  title: string;
  service: string;
  severity: SeverityLevel;
  status: IncidentStatus;
  opened?: string;
  minutes_to_resolve?: number;
  alert?: string;
  logs?: string;
  root_cause?: string;
  fix_steps?: string[];
  failed_attempts?: FailedAttempt[];
  engineer?: string;
  runbook?: string;
  source?: "seeded" | "learned";
  expected_family?: string;
  target_past_incident?: string;
  context_notes?: string;
}

export interface MemoryActivity {
  id: string;
  type: "retain" | "recall" | "reflect" | "retain_error" | "recall_error" | "reflect_error";
  summary: string;
  latency_ms: number;
  timestamp: string;
}

export interface MemoryEntry {
  id: string;
  title: string;
  service: string;
  severity: SeverityLevel;
  root_cause: string;
  fix_steps: string[];
  failed_attempts: FailedAttempt[];
  minutes_to_resolve: number;
  source: "seeded" | "learned";
  retained_at: string;
}

export interface MttrTimelinePoint {
  month: string;
  avg_mttr_minutes: number;
  agent_confidence: number;
  incidents_count: number;
}

export interface FamilyBreakdown {
  family: string;
  count: number;
}

export interface MttrInsightsResponse {
  timeline: MttrTimelinePoint[];
  families: FamilyBreakdown[];
  initial_mttr: number;
  current_mttr: number;
  improvement_pct: number;
}

export interface PatternsResponse {
  source: string;
  patterns: string;
  synthesized_at: string;
}

export interface HealthResponse {
  status: string;
  hindsight_connected: boolean;
  groq_configured: boolean;
  timestamp: string;
}

export interface AnalyzePayload {
  alert: string;
  logs: string;
  memory_enabled: boolean;
}

export interface OutcomePayload {
  incident_id: string;
  worked: string[];
  failed: FailedAttempt[];
  minutes: number;
  notes: string;
  service?: string;
  alert?: string;
  logs?: string;
  root_cause?: string;
}
