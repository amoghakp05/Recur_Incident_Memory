import React, { useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import type { Incident } from "../types/api";

interface ResolveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  incident: Incident;
  workedSteps: string[];
  failedSteps: { step: string; reason: string }[];
  onConfirm: (minutes: number, notes: string) => Promise<void>;
}

export const ResolveDialog: React.FC<ResolveDialogProps> = ({
  isOpen,
  onClose,
  incident,
  workedSteps,
  failedSteps,
  onConfirm,
}) => {
  const [minutes, setMinutes] = useState(incident.minutes_to_resolve || 15);
  const [notes, setNotes] = useState(
    incident.root_cause
      ? `Root cause confirmed: ${incident.root_cause}. Applied playbook successfully.`
      : "Verified resolution in production cluster."
  );
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onConfirm(minutes, notes);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl p-5 text-zinc-200">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Resolve & Save to Incident Memory</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div>
            <label className="text-[11px] font-mono text-zinc-400 block mb-1">
              Incident
            </label>
            <div className="p-2 rounded bg-zinc-950 border border-zinc-800 font-mono text-zinc-300">
              {incident.id}: {incident.title} ({incident.service})
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[11px] font-mono text-zinc-400 block mb-1">
                Steps Marked Worked ({workedSteps.length})
              </span>
              <div className="p-2 rounded bg-zinc-950 border border-zinc-800 max-h-24 overflow-y-auto space-y-1">
                {workedSteps.length > 0 ? (
                  workedSteps.map((s, i) => (
                    <div key={i} className="text-emerald-400 text-[11px] truncate">
                      ✓ {s}
                    </div>
                  ))
                ) : (
                  <span className="text-zinc-500 text-[11px]">None explicitly checked</span>
                )}
              </div>
            </div>

            <div>
              <span className="text-[11px] font-mono text-zinc-400 block mb-1">
                Steps Marked Failed ({failedSteps.length})
              </span>
              <div className="p-2 rounded bg-zinc-950 border border-zinc-800 max-h-24 overflow-y-auto space-y-1">
                {failedSteps.length > 0 ? (
                  failedSteps.map((f, i) => (
                    <div key={i} className="text-red-400 text-[11px] truncate">
                      ✗ {f.step}
                    </div>
                  ))
                ) : (
                  <span className="text-zinc-500 text-[11px]">No failed attempts</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-mono text-zinc-400 block mb-1">
              Total Resolution Time (Minutes to Resolve)
            </label>
            <input
              type="number"
              min="1"
              max="600"
              value={minutes}
              onChange={(e) => setMinutes(parseInt(e.target.value) || 1)}
              required
              className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono text-zinc-400 block mb-1">
              Post-Mortem Lessons & Retention Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What worked? What should future responders avoid?"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-200 focus:outline-none focus:border-blue-500 leading-relaxed"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 rounded hover:bg-zinc-800 text-zinc-400 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {submitting ? "Retaining to Hindsight..." : "Resolve and Save to Memory"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
