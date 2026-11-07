import React, { useState, useEffect } from "react";
import { Search, RotateCcw, AlertTriangle, Database, BarChart2 } from "lucide-react";
import type { Incident } from "../types/api";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: Incident[];
  onSelectIncident: (inc: Incident) => void;
  onNavigate: (view: "incidents" | "memory" | "insights") => void;
  onResetDemo: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  incidents,
  onSelectIncident,
  onNavigate,
  onResetDemo,
}) => {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery("");
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredIncidents = incidents.filter(
    (inc) =>
      inc.title.toLowerCase().includes(query.toLowerCase()) ||
      inc.id.toLowerCase().includes(query.toLowerCase()) ||
      inc.service.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden text-zinc-200">
        <div className="flex items-center px-3 border-b border-zinc-800">
          <Search className="w-4 h-4 text-zinc-500 mr-2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search incidents..."
            autoFocus
            className="w-full py-3 bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 border border-zinc-700 text-zinc-400 rounded">
            ESC
          </kbd>
        </div>

        <div className="p-2 text-xs space-y-1 max-h-80 overflow-y-auto">
          {/* Quick Actions */}
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 px-2 py-1">
            Navigation & Controls
          </div>
          <button
            onClick={() => {
              onNavigate("incidents");
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 text-left text-zinc-300"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-zinc-400" />
            <span>Go to Incidents Workspace</span>
          </button>
          <button
            onClick={() => {
              onNavigate("memory");
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 text-left text-zinc-300"
          >
            <Database className="w-3.5 h-3.5 text-zinc-400" />
            <span>Go to Memory Ledger & Activity</span>
          </button>
          <button
            onClick={() => {
              onNavigate("insights");
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 text-left text-zinc-300"
          >
            <BarChart2 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Go to MTTR Insights & Pattern Synthesis</span>
          </button>
          <button
            onClick={() => {
              onResetDemo();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 text-left text-amber-300"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Reset Demo Incidents State</span>
          </button>

          {/* Incidents search results */}
          {filteredIncidents.length > 0 && (
            <>
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 px-2 pt-2 pb-1">
                Matching Incidents
              </div>
              {filteredIncidents.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => {
                    onSelectIncident(inc);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-800 text-left"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono text-zinc-400 text-[11px]">{inc.id}</span>
                    <span className="text-zinc-200 truncate">{inc.title}</span>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-500 ml-2">{inc.service}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
