import React, { useState, useEffect } from "react";
import { Search, Database, Activity, RefreshCw } from "lucide-react";
import type { MemoryActivity, MemoryEntry } from "../types/api";
import { api } from "../services/api";
import { Skeleton } from "../components/ui/primitives";

export const MemoryView: React.FC = () => {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [activities, setActivities] = useState<MemoryActivity[]>([]);
  const [search, setSearch] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<MemoryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [eRes, aRes] = await Promise.all([
        api.getMemoryEntries(),
        api.getMemoryActivity(60),
      ]);
      setEntries(eRes);
      setActivities(aRes);
      if (eRes.length > 0 && !selectedEntry) {
        setSelectedEntry(eRes[0]);
      }
    } catch (err) {
      console.error("Failed to load memory data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  const filteredEntries = entries.filter(
    (e) =>
      e.id.toLowerCase().includes(search.toLowerCase()) ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.service.toLowerCase().includes(search.toLowerCase()) ||
      e.root_cause.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full w-full overflow-hidden bg-zinc-950">
      {/* LEFT: Searchable table of incidents the agent remembers */}
      <div className="flex-1 flex flex-col border-r border-zinc-800/80 min-w-0">
        <div className="p-3 border-b border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-400" />
            <h2 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
              Retained Incidents Ledger
            </h2>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400">
              {entries.length} stored
            </span>
          </div>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search remembered incidents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
            />
          </div>
        </div>

        {/* Dense Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No remembered incidents found matching search.
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80 text-[11px] font-mono text-zinc-500 bg-zinc-950 sticky top-0">
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Service</th>
                  <th className="py-2.5 px-3">Root Cause</th>
                  <th className="py-2.5 px-3">Key Fix</th>
                  <th className="py-2.5 px-3 text-right">Time</th>
                  <th className="py-2.5 px-3 text-right">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {filteredEntries.map((e) => {
                  const isSelected = selectedEntry?.id === e.id;
                  const fixSnippet = e.fix_steps?.[0] || "Resolved via playbook";

                  return (
                    <tr
                      key={e.id}
                      onClick={() => setSelectedEntry(e)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? "bg-zinc-900/90" : "hover:bg-zinc-900/40"
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-semibold text-blue-400">
                        {e.id}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-zinc-300">
                        {e.service}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-300 max-w-[220px] truncate" title={e.root_cause}>
                        {e.root_cause}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400 max-w-[200px] truncate" title={fixSnippet}>
                        {fixSnippet}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-zinc-400">
                        {e.minutes_to_resolve}m
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            e.source === "learned"
                              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/50"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {e.source || "seeded"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* RIGHT: Memory Activity Log */}
      <div className="w-[380px] lg:w-[440px] flex flex-col bg-zinc-900/30 shrink-0">
        <div className="p-3 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
              Memory Activity Log
            </h2>
          </div>
          <button
            onClick={fetchData}
            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            title="Refresh log"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Activity feed */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900 p-2 space-y-1">
          {activities.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">
              No memory activity recorded yet.
            </div>
          ) : (
            activities.map((act) => {
              const isRecall = act.type.startsWith("recall");
              const isRetain = act.type.startsWith("retain");
              const isReflect = act.type.startsWith("reflect");
              const isError = act.type.includes("error");

              return (
                <div
                  key={act.id}
                  className="p-2.5 rounded bg-zinc-950 border border-zinc-850 hover:border-zinc-750 transition-colors text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`px-1.5 py-0.2 rounded font-mono text-[10px] font-bold tracking-wider ${
                        isError
                          ? "bg-red-950/80 text-red-400 border border-red-900/50"
                          : isRetain
                          ? "bg-blue-950/80 text-blue-400 border border-blue-900/50"
                          : isRecall
                          ? "bg-purple-950/80 text-purple-400 border border-purple-900/50"
                          : isReflect
                          ? "bg-emerald-950/80 text-emerald-400 border border-emerald-900/50"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {act.type.toUpperCase()}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-400">
                      {act.latency_ms}ms
                    </span>
                  </div>

                  <p className="text-zinc-200 text-xs leading-relaxed">{act.summary}</p>

                  <div className="text-[10px] font-mono text-zinc-500 mt-1">
                    {new Date(act.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
