import React, { useState } from "react";
import {
  AlertTriangle,
  Database,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  RotateCcw,
  Search,
} from "lucide-react";
import type { HealthResponse } from "../types/api";

interface AppShellProps {
  currentTab: "incidents" | "memory" | "insights";
  onTabChange: (tab: "incidents" | "memory" | "insights") => void;
  openIncidentsCount: number;
  memoryEntriesCount: number;
  health: HealthResponse | null;
  onOpenCommandPalette: () => void;
  onResetDemo: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentTab,
  onTabChange,
  openIncidentsCount,
  memoryEntriesCount,
  health,
  onOpenCommandPalette,
  onResetDemo,
  isDark,
  onToggleTheme,
  children,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 ${isDark ? "dark" : ""}`}>
      {/* 232px Collapsible Left Sidebar */}
      <aside
        className={`flex flex-col border-r border-zinc-800/80 bg-zinc-900/60 shrink-0 transition-all duration-150 ${
          collapsed ? "w-[58px]" : "w-[232px]"
        }`}
      >
        {/* Workspace Brand Header */}
        <div className="h-12 border-b border-zinc-800/80 px-3 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center font-mono font-bold text-xs text-white shrink-0">
              R
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="text-xs font-semibold tracking-tight text-zinc-200">Recur</span>
                <span className="text-[10px] text-zinc-500 font-mono tracking-tight -mt-0.5">Incident Memory</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 text-xs"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-2 space-y-1">
          <button
            onClick={() => onTabChange("incidents")}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
              currentTab === "incidents"
                ? "bg-zinc-800 text-zinc-100 font-medium"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-zinc-400" />
              {!collapsed && <span>Incidents</span>}
            </div>
            {!collapsed && openIncidentsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-red-950/80 text-red-400 border border-red-800/50">
                {openIncidentsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange("memory")}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
              currentTab === "memory"
                ? "bg-zinc-800 text-zinc-100 font-medium"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-zinc-400" />
              {!collapsed && <span>Memory</span>}
            </div>
            {!collapsed && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono text-zinc-400 bg-zinc-800 border border-zinc-700/60">
                {memoryEntriesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange("insights")}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
              currentTab === "insights"
                ? "bg-zinc-800 text-zinc-100 font-medium"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <BarChart2 className="w-4 h-4 text-zinc-400" />
              {!collapsed && <span>Insights</span>}
            </div>
          </button>
        </nav>

        {/* Sidebar Footer */}
        {!collapsed && (
          <div className="p-2.5 border-t border-zinc-800/80 text-[11px] font-mono text-zinc-500">
            <div className="flex items-center justify-between mb-1.5">
              <span>Hindsight Cloud</span>
              <span className="text-emerald-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Active
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-600">
              <span>LLM Engine</span>
              <span>Groq (120B)</span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Utilitarian Top Bar */}
        <header className="h-12 border-b border-zinc-800/80 bg-zinc-950 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-zinc-500">Workspace /</span>
              <span className="text-zinc-300 font-medium">Production Reliability</span>
            </div>
            <span className="text-zinc-700">|</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  health?.hindsight_connected ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              <span>
                {health?.hindsight_connected ? "Hindsight Cloud Connected" : "Memory Disconnected"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search / Command palette trigger */}
            <button
              onClick={onOpenCommandPalette}
              className="flex items-center gap-2 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-400"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search or jump to...</span>
              <kbd className="px-1.5 py-0.2 text-[10px] font-mono bg-zinc-800 border border-zinc-700 text-zinc-400 rounded">
                ⌘K
              </kbd>
            </button>

            {/* Reset demo data action */}
            <button
              onClick={onResetDemo}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300"
              title="Reset sample incidents to initial OPEN state"
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Reset Demo</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={onToggleTheme}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              title="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Dynamic View Container */}
        <main className="flex-1 overflow-hidden relative">{children}</main>
      </div>
    </div>
  );
};
