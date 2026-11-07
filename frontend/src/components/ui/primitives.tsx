import React from "react";
import type { SeverityLevel, IncidentStatus } from "../../types/api";

/**
 * SeverityBadge with desaturated semantic colors and 1px borders.
 */
export const SeverityBadge: React.FC<{ severity: SeverityLevel; className?: string }> = ({
  severity,
  className = "",
}) => {
  const styles: Record<SeverityLevel, string> = {
    CRITICAL: "bg-red-950/40 text-red-400 border-red-800/50",
    HIGH: "bg-orange-950/40 text-orange-400 border-orange-800/50",
    MEDIUM: "bg-amber-950/40 text-amber-400 border-amber-800/50",
    LOW: "bg-zinc-800/40 text-zinc-400 border-zinc-700/50",
  };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium tracking-tight border ${
        styles[severity] || styles.MEDIUM
      } ${className}`}
    >
      {severity}
    </span>
  );
};

/**
 * StatusDot for incident lifecycle states.
 */
export const StatusDot: React.FC<{ status: IncidentStatus | string; showLabel?: boolean }> = ({
  status,
  showLabel = true,
}) => {
  const isResolved = status === "RESOLVED";
  const isOpen = status === "OPEN";

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isResolved
            ? "bg-emerald-500"
            : isOpen
            ? "bg-red-500 animate-pulse"
            : "bg-amber-500"
        }`}
      />
      {showLabel && (
        <span className={isResolved ? "text-zinc-400" : isOpen ? "text-zinc-200 font-medium" : "text-zinc-400"}>
          {status}
        </span>
      )}
    </span>
  );
};

/**
 * LogViewer: Monospace, line numbers, highlighted error/fatal lines.
 */
export const LogViewer: React.FC<{ logs: string; maxHeight?: string }> = ({
  logs,
  maxHeight = "max-h-[380px]",
}) => {
  const lines = logs.trim().split("\n");

  return (
    <div
      className={`w-full overflow-x-auto overflow-y-auto bg-zinc-950 border border-zinc-800/80 rounded font-mono text-[12px] leading-relaxed select-text ${maxHeight}`}
    >
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, idx) => {
            const isError = line.includes("[ERROR]") || line.includes("[FATAL]") || line.includes("panic:");
            const isWarn = line.includes("[WARN]");

            return (
              <tr
                key={idx}
                className={`hover:bg-zinc-900/60 ${
                  isError ? "bg-red-950/20 text-red-300" : isWarn ? "bg-amber-950/20 text-amber-200" : "text-zinc-300"
                }`}
              >
                <td className="w-10 px-2 py-0.5 text-right text-zinc-600 select-none border-r border-zinc-800/50 text-[11px] font-mono">
                  {idx + 1}
                </td>
                <td className="px-3 py-0.5 whitespace-pre font-mono">
                  {line}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/**
 * ConfidenceMeter: Clean number plus 2px thin progress bar.
 */
export const ConfidenceMeter: React.FC<{ confidence: number; label?: string }> = ({
  confidence,
  label = "Agent Confidence",
}) => {
  const color =
    confidence >= 80 ? "bg-blue-500" : confidence >= 50 ? "bg-amber-500" : "bg-zinc-600";

  return (
    <div className="flex flex-col gap-1 w-full max-w-[160px]">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400 text-[11px] uppercase tracking-wider">{label}</span>
        <span className="font-mono font-medium text-zinc-200 text-xs">{confidence}%</span>
      </div>
      <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${confidence}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Utilitarian EmptyState.
 */
export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-zinc-800 rounded bg-zinc-900/20">
    <h4 className="text-sm font-medium text-zinc-300 mb-1">{title}</h4>
    <p className="text-xs text-zinc-500 max-w-sm mb-4 leading-relaxed">{description}</p>
    {action}
  </div>
);

/**
 * ErrorState with retry trigger.
 */
export const ErrorState: React.FC<{
  message: string;
  onRetry?: () => void;
}> = ({ message, onRetry }) => (
  <div className="p-4 border border-red-900/50 bg-red-950/20 rounded text-xs text-red-300 flex items-center justify-between">
    <span>{message}</span>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-2 py-1 bg-red-900/40 hover:bg-red-900/60 text-red-200 rounded text-[11px] font-medium"
      >
        Retry
      </button>
    )}
  </div>
);

/**
 * Minimal Skeleton loader.
 */
export const Skeleton: React.FC<{ className?: string }> = ({ className = "h-4 w-full" }) => (
  <div className={`animate-pulse bg-zinc-800/60 rounded ${className}`} />
);
