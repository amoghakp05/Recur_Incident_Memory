import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import type { Incident, SeverityLevel } from "../types/api";

interface NewIncidentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  demoIncidents: Incident[];
  onSelectDemo: (demo: Incident) => void;
  onCreateIncident: (incident: Partial<Incident>) => void;
}

export const NewIncidentSheet: React.FC<NewIncidentSheetProps> = ({
  isOpen,
  onClose,
  demoIncidents,
  onSelectDemo,
  onCreateIncident,
}) => {
  const [tab, setTab] = useState<"custom" | "demo">("demo");
  const [title, setTitle] = useState("");
  const [service, setService] = useState("payments-api");
  const [severity, setSeverity] = useState<SeverityLevel>("HIGH");
  const [alert, setAlert] = useState("");
  const [logs, setLogs] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !alert.trim()) return;

    onCreateIncident({
      id: `INC-${Math.floor(100 + Math.random() * 900)}`,
      title: title || alert.slice(0, 60),
      service,
      severity,
      status: "OPEN",
      opened: new Date().toISOString(),
      alert,
      logs,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-zinc-900 border-l border-zinc-800 h-full flex flex-col p-5 shadow-2xl text-zinc-200">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Trigger or Load Incident</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab segmented control */}
        <div className="flex bg-zinc-950 p-0.5 rounded border border-zinc-800 my-4">
          <button
            onClick={() => setTab("demo")}
            className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
              tab === "demo" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Load Sample Incident (6 Demos)
          </button>
          <button
            onClick={() => setTab("custom")}
            className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
              tab === "custom" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Paste Custom Alert & Logs
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "demo" ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-400 mb-2">
                Select an unseeded live evaluation incident to test memory recall against the 30 retained incidents:
              </p>
              {demoIncidents.map((demo) => (
                <div
                  key={demo.id}
                  onClick={() => {
                    onSelectDemo(demo);
                    onClose();
                  }}
                  className="p-3 bg-zinc-950 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 rounded cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-semibold text-blue-400">{demo.id}</span>
                    <span className="text-[11px] font-mono text-zinc-500">{demo.service}</span>
                  </div>
                  <div className="text-xs font-medium text-zinc-200 mb-1">{demo.title}</div>
                  <div className="text-[11px] text-zinc-400 line-clamp-2">{demo.alert}</div>
                  {demo.context_notes && (
                    <div className="mt-2 text-[10px] text-zinc-500 italic">
                      Context: {demo.context_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 504 Gateway Timeouts in checkout flow"
                  required
                  className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-zinc-400 block mb-1">Service</label>
                  <input
                    type="text"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-zinc-400 block mb-1">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                    className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">Alert Text</label>
                <textarea
                  rows={2}
                  value={alert}
                  onChange={(e) => setAlert(e.target.value)}
                  placeholder="Paste alert message or pager text"
                  required
                  className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">
                  Representative Error Logs (8-15 lines)
                </label>
                <textarea
                  rows={6}
                  value={logs}
                  onChange={(e) => setLogs(e.target.value)}
                  placeholder="Paste stack traces or log lines"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded font-mono text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded text-xs transition-colors"
              >
                Create and Diagnose
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
