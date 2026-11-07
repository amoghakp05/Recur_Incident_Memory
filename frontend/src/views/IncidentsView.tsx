import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  AlertOctagon,
  Clock,
  CheckCircle2,
  Cpu,
  Layers,
  Sparkles,
} from "lucide-react";
import type { Incident, IncidentAnalysis, MatchedIncident, AvoidStep } from "../types/api";
import {
  SeverityBadge,
  StatusDot,
  LogViewer,
  ConfidenceMeter,
  EmptyState,
  ErrorState,
  Skeleton,
} from "../components/ui/primitives";
import { ResolveDialog } from "../components/ResolveDialog";
import { NewIncidentSheet } from "../components/NewIncidentSheet";
import { api } from "../services/api";
import { useToast } from "../components/Toast";

interface IncidentsViewProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (inc: Incident) => void;
  onRefreshIncidents: () => void;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  incidents,
  selectedIncident,
  onSelectIncident,
  onRefreshIncidents,
}) => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"analysis" | "logs" | "timeline">("analysis");

  // Memory comparison mode: "on" | "off" | "compare" (Step 8 Innovation Edge)
  const [memoryMode, setMemoryMode] = useState<"on" | "off" | "compare">("on");

  // Analysis states
  const [analysisWithMemory, setAnalysisWithMemory] = useState<IncidentAnalysis | null>(null);
  const [analysisWithoutMemory, setAnalysisWithoutMemory] = useState<IncidentAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Resolution checklist states
  const [workedSteps, setWorkedSteps] = useState<string[]>([]);
  const [failedSteps, setFailedSteps] = useState<{ step: string; reason: string }[]>([]);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [isNewSheetOpen, setIsNewSheetOpen] = useState(false);

  // Trigger analysis whenever selected incident changes or memory mode changes
  useEffect(() => {
    if (!selectedIncident) return;

    setWorkedSteps([]);
    setFailedSteps([]);
    setAnalysisError(null);

    const runAnalysis = async () => {
      setIsAnalyzing(true);
      try {
        const alert = selectedIncident.alert || selectedIncident.title;
        const logs = selectedIncident.logs || "No logs attached";

        if (memoryMode === "on" || memoryMode === "compare") {
          const resOn = await api.analyzeIncident({
            alert,
            logs,
            memory_enabled: true,
          });
          setAnalysisWithMemory(resOn);
        }

        if (memoryMode === "off" || memoryMode === "compare") {
          const resOff = await api.analyzeIncident({
            alert,
            logs,
            memory_enabled: false,
          });
          setAnalysisWithoutMemory(resOff);
        }
      } catch (err: any) {
        setAnalysisError(err.message || "Failed to analyze incident.");
      } finally {
        setIsAnalyzing(false);
      }
    };

    runAnalysis();
  }, [selectedIncident?.id, memoryMode]);

  // Filter incidents list
  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch =
      inc.title.toLowerCase().includes(search.toLowerCase()) ||
      inc.id.toLowerCase().includes(search.toLowerCase()) ||
      inc.service.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || inc.status === statusFilter;
    const matchesSeverity = severityFilter === "ALL" || inc.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  const demoIncidents = incidents.filter((i) => i.id.startsWith("DEMO-"));

  // Handle resolving and retaining
  const handleConfirmResolve = async (minutes: number, notes: string) => {
    if (!selectedIncident) return;
    try {
      await api.recordOutcome({
        incident_id: selectedIncident.id,
        worked: workedSteps,
        failed: failedSteps,
        minutes,
        notes,
        service: selectedIncident.service,
        alert: selectedIncident.alert,
        logs: selectedIncident.logs,
        root_cause: analysisWithMemory?.diagnosis || selectedIncident.root_cause || "",
      });
      toast(`Saved to memory: Incident ${selectedIncident.id} resolved in ${minutes} min`, "success");
      onRefreshIncidents();
    } catch (e: any) {
      toast(`Error saving to memory: ${e.message}`, "error");
    }
  };

  const toggleStepWorked = (step: string) => {
    setWorkedSteps((prev: string[]) =>
      prev.includes(step) ? prev.filter((s: string) => s !== step) : [...prev, step]
    );
    // Remove from failed if was there
    setFailedSteps((prev: { step: string; reason: string }[]) =>
      prev.filter((f: { step: string; reason: string }) => f.step !== step)
    );
  };

  const toggleStepFailed = (step: string) => {
    setFailedSteps((prev: { step: string; reason: string }[]) =>
      prev.some((f: { step: string; reason: string }) => f.step === step)
        ? prev.filter((f: { step: string; reason: string }) => f.step !== step)
        : [...prev, { step, reason: "Attempt failed during triage in live pod" }]
    );
    // Remove from worked if was there
    setWorkedSteps((prev: string[]) => prev.filter((s: string) => s !== step));
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* LEFT: Dense Incidents Table (Master List) */}
      <div className="w-[380px] lg:w-[420px] border-r border-zinc-800/80 bg-zinc-950 flex flex-col shrink-0">
        {/* Search & Actions Bar */}
        <div className="p-3 border-b border-zinc-800/80 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filter by ID, title, or service..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
              />
            </div>
            <button
              onClick={() => setIsNewSheetOpen(true)}
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded text-xs flex items-center gap-1 shrink-0"
              title="New incident or load sample demo"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-1">
              {["ALL", "OPEN", "RESOLVED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    statusFilter === st
                      ? "bg-zinc-800 text-zinc-100 font-semibold"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-850 px-1 py-0.5 rounded text-[10px] font-mono text-zinc-400 focus:outline-none"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
            </select>

            <div className="text-zinc-500">
              {filteredIncidents.length} {filteredIncidents.length === 1 ? "incident" : "incidents"}
            </div>
          </div>
        </div>

        {/* Master Incidents List */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
          {filteredIncidents.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No matching incidents found.
            </div>
          ) : (
            filteredIncidents.map((inc) => {
              const isSelected = selectedIncident?.id === inc.id;
              const isDemo = inc.id.startsWith("DEMO-");

              return (
                <div
                  key={inc.id}
                  onClick={() => onSelectIncident(inc)}
                  className={`p-3 cursor-pointer text-left transition-colors relative ${
                    isSelected
                      ? "bg-zinc-900/90 border-l-2 border-l-blue-500"
                      : "hover:bg-zinc-900/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-zinc-300">
                        {inc.id}
                      </span>
                      {isDemo && (
                        <span className="px-1 py-0.2 rounded text-[9px] font-mono bg-blue-950/60 text-blue-400 border border-blue-900/50">
                          DEMO
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <SeverityBadge severity={inc.severity} />
                      <StatusDot status={inc.status} showLabel={false} />
                    </div>
                  </div>

                  <div className="text-xs font-medium text-zinc-200 line-clamp-1 mb-1">
                    {inc.title}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                    <span className="truncate max-w-[180px]">{inc.service}</span>
                    <span>
                      {inc.minutes_to_resolve
                        ? `resolved in ${inc.minutes_to_resolve} min`
                        : "active now"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: Incident Detail Panel */}
      <div className="flex-1 bg-zinc-950 flex flex-col min-w-0 overflow-hidden">
        {selectedIncident ? (
          <>
            {/* Incident Header */}
            <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/30 flex items-start justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-zinc-400">
                    {selectedIncident.id}
                  </span>
                  <span className="text-zinc-600">/</span>
                  <span className="font-mono text-xs text-blue-400">
                    {selectedIncident.service}
                  </span>
                  <SeverityBadge severity={selectedIncident.severity} />
                  <StatusDot status={selectedIncident.status} />
                  {selectedIncident.minutes_to_resolve && (
                    <span className="font-mono text-[11px] text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      resolved in {selectedIncident.minutes_to_resolve} min
                    </span>
                  )}
                </div>

                <h2 className="text-base font-semibold text-zinc-100 truncate">
                  {selectedIncident.title}
                </h2>
                {selectedIncident.alert && (
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                    {selectedIncident.alert}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {selectedIncident.status !== "RESOLVED" && (
                  <button
                    onClick={() => setIsResolveOpen(true)}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Resolve & Save to Memory</span>
                  </button>
                )}
              </div>
            </div>

            {/* Sub-header Navigation Tabs & Segmented Memory Control */}
            <div className="px-4 border-b border-zinc-800/80 bg-zinc-950 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4 text-xs">
                <button
                  onClick={() => setActiveTab("analysis")}
                  className={`py-2.5 font-medium border-b-2 transition-colors ${
                    activeTab === "analysis"
                      ? "border-blue-500 text-zinc-100"
                      : "border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Analysis & Memory
                </button>
                <button
                  onClick={() => setActiveTab("logs")}
                  className={`py-2.5 font-medium border-b-2 transition-colors ${
                    activeTab === "logs"
                      ? "border-blue-500 text-zinc-100"
                      : "border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Representative Logs
                </button>
                <button
                  onClick={() => setActiveTab("timeline")}
                  className={`py-2.5 font-medium border-b-2 transition-colors ${
                    activeTab === "timeline"
                      ? "border-blue-500 text-zinc-100"
                      : "border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Context & Metadata
                </button>
              </div>

              {/* Step 8 Innovation Edge: Segmented Control (Memory: On / Off / Compare) */}
              {activeTab === "analysis" && (
                <div className="flex items-center gap-2 py-2">
                  <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider hidden sm:inline">
                    Memory:
                  </span>
                  <div className="flex bg-zinc-900 border border-zinc-800 rounded p-0.5 text-xs font-mono">
                    <button
                      onClick={() => setMemoryMode("on")}
                      className={`px-2.5 py-0.5 rounded transition-colors ${
                        memoryMode === "on"
                          ? "bg-zinc-800 text-blue-400 font-semibold"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      On
                    </button>
                    <button
                      onClick={() => setMemoryMode("off")}
                      className={`px-2.5 py-0.5 rounded transition-colors ${
                        memoryMode === "off"
                          ? "bg-zinc-800 text-zinc-200 font-semibold"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Off
                    </button>
                    <button
                      onClick={() => setMemoryMode("compare")}
                      className={`px-2.5 py-0.5 rounded transition-colors ${
                        memoryMode === "compare"
                          ? "bg-blue-600 text-white font-semibold"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Compare
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeTab === "analysis" && (
                <>
                  {isAnalyzing && (
                    <div className="p-6 border border-zinc-800 rounded bg-zinc-900/30 space-y-3">
                      <div className="flex items-center gap-2 text-xs text-blue-400 font-mono">
                        <Cpu className="w-4 h-4 animate-spin text-blue-400" />
                        <span>Recalling similar past incidents from Hindsight Cloud & reasoning with Groq...</span>
                      </div>
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-8 w-1/2" />
                    </div>
                  )}

                  {analysisError && (
                    <ErrorState message={analysisError} />
                  )}

                  {!isAnalyzing && (
                    <>
                      {/* Step 8 Compare Mode View */}
                      {memoryMode === "compare" && analysisWithMemory && analysisWithoutMemory ? (
                        <div className="space-y-4">
                          {/* Sober Summary Row showing exact quantified differences */}
                          <div className="grid grid-cols-2 gap-4 p-3 bg-zinc-900/70 border border-zinc-800 rounded text-xs font-mono">
                            <div className="text-zinc-400">
                              <span className="text-zinc-500 uppercase tracking-wider block text-[10px] mb-1">
                                Without Memory Baseline
                              </span>
                              <div>
                                Estimated Time: <span className="text-amber-400 font-bold">{analysisWithoutMemory.estimated_minutes} min</span>
                              </div>
                              <div>
                                Confidence: <span className="text-zinc-400">{analysisWithoutMemory.confidence}%</span>
                              </div>
                            </div>
                            <div className="text-zinc-300 border-l border-zinc-800 pl-4">
                              <span className="text-blue-400 uppercase tracking-wider block text-[10px] mb-1">
                                With Incident Memory Advantage
                              </span>
                              <div>
                                Estimated Time: <span className="text-emerald-400 font-bold">{analysisWithMemory.estimated_minutes} min</span>{" "}
                                <span className="text-emerald-500 text-[11px]">
                                  ({analysisWithoutMemory.estimated_minutes - analysisWithMemory.estimated_minutes}m faster)
                                </span>
                              </div>
                              <div>
                                Confidence: <span className="text-blue-400 font-bold">{analysisWithMemory.confidence}%</span>{" "}
                                <span className="text-blue-400 text-[11px]">
                                  (+{analysisWithMemory.confidence - analysisWithoutMemory.confidence}%)
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Side-by-Side Comparison Columns */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* LEFT COLUMN: Without Memory */}
                            <div className="border border-zinc-800/80 rounded bg-zinc-950 p-4 space-y-4">
                              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                                <span className="font-mono text-xs font-semibold text-zinc-400">
                                  WITHOUT MEMORY
                                </span>
                                <ConfidenceMeter confidence={analysisWithoutMemory.confidence} label="Confidence" />
                              </div>

                              <div>
                                <h4 className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider mb-1">
                                  Generic Diagnosis
                                </h4>
                                <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/50 p-2.5 rounded border border-zinc-800/60">
                                  {analysisWithoutMemory.diagnosis}
                                </p>
                              </div>

                              <div>
                                <h4 className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider mb-1">
                                  Standard Steps (Trial & Error)
                                </h4>
                                <ol className="space-y-1.5 text-xs text-zinc-300">
                                  {analysisWithoutMemory.recommended_steps.map((st: string, i: number) => (
                                    <li key={i} className="p-2 bg-zinc-900/40 rounded border border-zinc-800/40">
                                      {i + 1}. {st}
                                    </li>
                                  ))}
                                </ol>
                              </div>

                              <div>
                                <h4 className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider mb-1">
                                  Citations / Past Precedents
                                </h4>
                                <div className="p-2.5 rounded bg-zinc-900/30 border border-dashed border-zinc-800 text-[11px] text-zinc-500 italic">
                                  None. Without organizational memory, on-call engineer starts from scratch.
                                </div>
                              </div>
                            </div>

                            {/* RIGHT COLUMN: With Memory */}
                            <div className="border border-blue-900/50 rounded bg-zinc-950 p-4 space-y-4">
                              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                                <span className="font-mono text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                                  WITH HINDSIGHT MEMORY
                                </span>
                                <ConfidenceMeter confidence={analysisWithMemory.confidence} label="Confidence" />
                              </div>

                              <div>
                                <h4 className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                                  Likely Root Cause (Grounded)
                                </h4>
                                <p className="text-xs text-zinc-200 leading-relaxed bg-blue-950/20 p-2.5 rounded border border-blue-900/40">
                                  {analysisWithMemory.diagnosis}
                                </p>
                              </div>

                              {/* Avoid panel */}
                              {analysisWithMemory.avoid.length > 0 && (
                                <div>
                                  <h4 className="text-[11px] font-mono text-red-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
                                    Avoid (Failed in Past Incidents)
                                  </h4>
                                  <div className="space-y-2">
                                    {analysisWithMemory.avoid.map((av: AvoidStep, idx: number) => (
                                      <div
                                        key={idx}
                                        className="p-2.5 rounded bg-red-950/25 border border-red-900/40 text-xs text-red-300"
                                      >
                                        <div className="font-semibold text-red-200">
                                          ✗ DO NOT: {av.step}
                                        </div>
                                        <div className="text-[11px] text-red-400 mt-0.5">
                                          Reason: {av.reason}
                                        </div>
                                        <div className="text-[10px] font-mono text-red-500 mt-1">
                                          Source: {av.source_incident}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div>
                                <h4 className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                                  Targeted Fix Steps (Past Proven)
                                </h4>
                                <ol className="space-y-1.5 text-xs text-zinc-200">
                                  {analysisWithMemory.recommended_steps.map((st: string, i: number) => (
                                    <li
                                      key={i}
                                      className="p-2 bg-zinc-900/80 rounded border border-zinc-800 flex items-start justify-between gap-2"
                                    >
                                      <span>
                                        {i + 1}. {st}
                                      </span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Standard Single Analysis View (Memory On or Off) */
                        (() => {
                          const currentAnalysis =
                            memoryMode === "off" ? analysisWithoutMemory : analysisWithMemory;
                          if (!currentAnalysis) return null;

                          return (
                            <div className="space-y-4">
                              {/* Root Cause & Confidence Card */}
                              <div className="p-4 border border-zinc-800 rounded bg-zinc-900/40 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                                    Diagnosed Root Cause
                                  </span>
                                  <ConfidenceMeter confidence={currentAnalysis.confidence} />
                                </div>

                                <p className="text-sm font-medium text-zinc-100 leading-relaxed">
                                  {currentAnalysis.diagnosis}
                                </p>

                                <div className="text-xs text-zinc-400 leading-relaxed font-mono text-[11px] bg-zinc-950 p-2 rounded border border-zinc-800/80">
                                  Reasoning: {currentAnalysis.reasoning}
                                </div>
                              </div>

                              {/* Evidence from Past Incidents Table */}
                              {currentAnalysis.matched_incidents.length > 0 && (
                                <div className="border border-zinc-800 rounded bg-zinc-950 overflow-hidden">
                                  <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                                      Evidence from Past Incidents
                                    </span>
                                    <span className="text-[11px] font-mono text-zinc-500">
                                      Hindsight Semantic Match
                                    </span>
                                  </div>
                                  <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                      <tr className="border-b border-zinc-800 text-[11px] font-mono text-zinc-500">
                                        <th className="py-2 px-3">Incident</th>
                                        <th className="py-2 px-3">Similarity</th>
                                        <th className="py-2 px-3">Match Context</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/60 font-mono">
                                      {currentAnalysis.matched_incidents.map((match: MatchedIncident, i: number) => (
                                        <tr key={i} className="hover:bg-zinc-900/40">
                                          <td className="py-2 px-3 text-blue-400 font-bold">
                                            {match.id}
                                          </td>
                                          <td className="py-2 px-3 text-emerald-400 font-semibold">
                                            {match.similarity}%
                                          </td>
                                          <td className="py-2 px-3 text-zinc-300 font-sans text-xs">
                                            {match.why}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Avoid Panel (Steps That Failed in Past Incidents) */}
                              {currentAnalysis.avoid.length > 0 && (
                                <div className="border border-red-900/50 bg-red-950/20 rounded p-4 space-y-2">
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                                    <AlertOctagon className="w-4 h-4 text-red-400" />
                                    <span>Do Not Try (Previously Failed Fix Attempts)</span>
                                  </div>
                                  <div className="space-y-2 mt-2">
                                    {currentAnalysis.avoid.map((item: AvoidStep, idx: number) => (
                                      <div
                                        key={idx}
                                        className="p-2.5 rounded bg-zinc-950/80 border border-red-900/40 text-xs"
                                      >
                                        <div className="text-red-300 font-medium">
                                          ✗ {item.step}
                                        </div>
                                        <div className="text-[11px] text-zinc-400 mt-0.5">
                                          Reason: {item.reason}
                                        </div>
                                        <div className="text-[10px] font-mono text-zinc-500 mt-1">
                                          Cited Source: {item.source_incident}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Recommended Steps with Interactive Worked / Failed Checklist */}
                              <div className="border border-zinc-800 rounded bg-zinc-950 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-zinc-200">
                                    Recommended Remediation Steps
                                  </span>
                                  <span className="text-[11px] font-mono text-zinc-500">
                                    Mark Worked / Failed
                                  </span>
                                </div>

                                <div className="space-y-2">
                                  {currentAnalysis.recommended_steps.map((step: string, idx: number) => {
                                    const isWorked = workedSteps.includes(step);
                                    const isFailed = failedSteps.some((f: { step: string; reason: string }) => f.step === step);

                                    return (
                                      <div
                                        key={idx}
                                        className={`p-2.5 rounded border transition-colors flex items-start justify-between gap-3 text-xs ${
                                          isWorked
                                            ? "bg-emerald-950/20 border-emerald-800/50 text-emerald-200"
                                            : isFailed
                                            ? "bg-red-950/20 border-red-800/50 text-red-300"
                                            : "bg-zinc-900/60 border-zinc-800 text-zinc-200"
                                        }`}
                                      >
                                        <div className="flex items-start gap-2 flex-1">
                                          <span className="font-mono text-zinc-500 shrink-0 select-none">
                                            {idx + 1}.
                                          </span>
                                          <span className="leading-relaxed">{step}</span>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            onClick={() => toggleStepWorked(step)}
                                            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                                              isWorked
                                                ? "bg-emerald-600 text-white font-bold"
                                                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
                                            }`}
                                          >
                                            Worked
                                          </button>
                                          <button
                                            onClick={() => toggleStepFailed(step)}
                                            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                                              isFailed
                                                ? "bg-red-600 text-white font-bold"
                                                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
                                            }`}
                                          >
                                            Failed
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </>
                  )}
                </>
              )}

              {/* Logs Tab */}
              {activeTab === "logs" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-mono text-[11px]">System Output & Stack Trace</span>
                    <span className="font-mono text-[11px] text-zinc-500">
                      {selectedIncident.logs?.split("\n").length || 0} lines
                    </span>
                  </div>
                  <LogViewer logs={selectedIncident.logs || "No logs available"} maxHeight="max-h-[550px]" />
                </div>
              )}

              {/* Timeline & Metadata Tab */}
              {activeTab === "timeline" && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded font-mono space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Incident ID:</span>
                      <span className="text-zinc-200">{selectedIncident.id}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Service:</span>
                      <span className="text-blue-400">{selectedIncident.service}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Severity:</span>
                      <SeverityBadge severity={selectedIncident.severity} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Status:</span>
                      <StatusDot status={selectedIncident.status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Opened At:</span>
                      <span className="text-zinc-300">{selectedIncident.opened || "N/A"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Associated Runbook:</span>
                      <span className="text-zinc-300">{selectedIncident.runbook || "runbooks/incident.md"}</span>
                    </div>
                  </div>

                  {selectedIncident.failed_attempts && selectedIncident.failed_attempts.length > 0 && (
                    <div className="p-3 bg-red-950/20 border border-red-900/50 rounded space-y-2">
                      <div className="font-semibold text-red-300">Historical Failed Attempts Recorded:</div>
                      {selectedIncident.failed_attempts.map((fa, i) => (
                        <div key={i} className="text-[11px] text-red-400">
                          - {fa.step} → {fa.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Resolve and Save to Memory Dialog */}
            <ResolveDialog
              isOpen={isResolveOpen}
              onClose={() => setIsResolveOpen(false)}
              incident={selectedIncident}
              workedSteps={workedSteps}
              failedSteps={failedSteps}
              onConfirm={handleConfirmResolve}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <EmptyState
              title="No incident selected"
              description="Select an incident from the master list or trigger a sample demo incident."
              action={
                <button
                  onClick={() => setIsNewSheetOpen(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded text-xs"
                >
                  Load Sample Incident
                </button>
              }
            />
          </div>
        )}
      </div>

      {/* New Incident / Demo Incident Sheet */}
      <NewIncidentSheet
        isOpen={isNewSheetOpen}
        onClose={() => setIsNewSheetOpen(false)}
        demoIncidents={demoIncidents}
        onSelectDemo={(demo) => {
          onSelectIncident(demo);
        }}
        onCreateIncident={(newInc) => {
          onSelectIncident(newInc as Incident);
          onRefreshIncidents();
        }}
      />
    </div>
  );
};
