/**
 * Typed HTTP Client for Recur Backend.
 * Direct typed requests to FastAPI endpoints.
 */

import type {
  AnalyzePayload,
  HealthResponse,
  Incident,
  IncidentAnalysis,
  MemoryActivity,
  MemoryEntry,
  MttrInsightsResponse,
  OutcomePayload,
  PatternsResponse,
} from "../types/api";

const API_BASE = "/api";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson.detail) detail = errJson.detail;
    } catch {
      // Use fallback error
    }
    throw new Error(detail);
  }

  return res.json() as Promise<T>;
}

export const api = {
  getHealth: () => request<HealthResponse>("/health"),

  getIncidents: (statusFilter?: string) => {
    const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
    return request<Incident[]>(`/incidents${q}`);
  },

  getIncidentById: (id: string) => request<Incident>(`/incidents/${encodeURIComponent(id)}`),

  analyzeIncident: (payload: AnalyzePayload) =>
    request<IncidentAnalysis>("/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  recordOutcome: (payload: OutcomePayload) =>
    request<{ status: string; message: string; latency_ms: number }>("/outcome", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getMemoryActivity: (limit = 50) =>
    request<MemoryActivity[]>(`/memory/activity?limit=${limit}`),

  getMemoryEntries: () => request<MemoryEntry[]>("/memory/entries"),

  getMttrInsights: () => request<MttrInsightsResponse>("/insights/mttr"),

  getPatterns: () => request<PatternsResponse>("/insights/patterns"),

  resetDemo: () =>
    request<{ status: string; message: string; active_demo_count: number }>("/demo/reset", {
      method: "POST",
    }),
};
