import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Brain, RefreshCw } from "lucide-react";
import type { MttrInsightsResponse, PatternsResponse } from "../types/api";
import { api } from "../services/api";
import { Skeleton, ErrorState } from "../components/ui/primitives";

export const InsightsView: React.FC = () => {
  const [mttrData, setMttrData] = useState<MttrInsightsResponse | null>(null);
  const [patternsData, setPatternsData] = useState<PatternsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      const [mttr, patterns] = await Promise.all([
        api.getMttrInsights(),
        api.getPatterns(),
      ]);
      setMttrData(mttr);
      setPatternsData(patterns);
    } catch (err: any) {
      setError(err.message || "Failed to load insights.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !mttrData) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <ErrorState message={error || "Failed to load metrics."} onRetry={fetchInsights} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto text-zinc-100">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-base font-semibold text-zinc-100">
            Reliability Analytics & Memory ROI
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Demonstrating MTTR reduction and agent confidence as organizational incident memory accumulates.
          </p>
        </div>
        <button
          onClick={fetchInsights}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          title="Refresh insights"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
            Initial Resolution Time
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {mttrData.initial_mttr}m
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Trial & error baseline</div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
            Current Resolution Time
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {mttrData.current_mttr}m
          </div>
          <div className="text-[11px] text-emerald-500 mt-1 font-medium">
            ↓ {mttrData.improvement_pct}% MTTR reduction
          </div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
            Agent Diagnostic Confidence
          </div>
          <div className="text-2xl font-bold font-mono text-blue-400">
            {mttrData.timeline[mttrData.timeline.length - 1]?.agent_confidence || 94}%
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Grounded in Hindsight memory</div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
            Memory Efficiency
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-200">
            {(mttrData.initial_mttr / Math.max(1, mttrData.current_mttr)).toFixed(1)}x
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Faster on-call remediation</div>
        </div>
      </div>

      {/* Chart 1: MTTR Reduction and Confidence Growth over Time */}
      <div className="p-5 bg-zinc-900/40 border border-zinc-800 rounded space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
              MTTR Reduction vs. Agent Confidence Over 6 Months
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Resolution time in minutes (left axis) vs. Diagnostic confidence percentage (right axis).
            </p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mttrData.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="month" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis yAxisId="left" stroke="#71717a" fontSize={11} tickLine={false} unit="m" />
              <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={11} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  borderColor: "#27272a",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="avg_mttr_minutes"
                name="Avg MTTR (Minutes)"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3, fill: "#f59e0b" }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="agent_confidence"
                name="Confidence (%)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3b82f6" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Recurring Root-Cause Families Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 bg-zinc-900/40 border border-zinc-800 rounded space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
              Recurring Root-Cause Families
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Historical distribution across the 7 tracked infrastructure failure domains.
            </p>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mttrData.families} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" stroke="#71717a" fontSize={10} tickLine={false} />
                <YAxis dataKey="family" type="category" stroke="#a1a1aa" fontSize={10} width={130} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    borderColor: "#27272a",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" name="Incidents" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Patterns Panel Synthesized via Hindsight Reflect */}
        <div className="p-5 bg-zinc-900/40 border border-zinc-800 rounded flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
                Synthesized Architectural Patterns
              </h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">
              Hindsight Reflect
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-56 p-3 bg-zinc-950 border border-zinc-850 rounded font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap select-text">
            {patternsData?.patterns || "Analyzing infrastructure patterns..."}
          </div>
        </div>
      </div>
    </div>
  );
};
