import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { AppShell } from "./components/AppShell";
import { IncidentsView } from "./views/IncidentsView";
import { MemoryView } from "./views/MemoryView";
import { InsightsView } from "./views/InsightsView";
import { CommandPalette } from "./components/CommandPalette";
import { ToastProvider, useToast } from "./components/Toast";
import { api } from "./services/api";
import type { Incident } from "./types/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});

const RecurApp: React.FC = () => {
  const { toast } = useToast();
  const [currentTab, setCurrentTab] = useState<"incidents" | "memory" | "insights">("incidents");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  // Sync dark class on document element
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  // Fetch Health
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: api.getHealth,
    refetchInterval: 12000,
  });

  // Fetch Incidents
  const {
    data: incidents = [],
    refetch: refetchIncidents,
  } = useQuery({
    queryKey: ["incidents"],
    queryFn: () => api.getIncidents(),
  });

  // Fetch Memory Entries count
  const { data: memoryEntries = [], refetch: refetchMemory } = useQuery({
    queryKey: ["memoryEntries"],
    queryFn: api.getMemoryEntries,
  });

  // Auto-select first demo incident if none selected
  useEffect(() => {
    if (incidents.length > 0 && !selectedIncident) {
      const demoFirst = incidents.find((i) => i.id === "DEMO-001") || incidents[0];
      setSelectedIncident(demoFirst);
    }
  }, [incidents, selectedIncident]);

  // Reset Demo Mutation
  const resetDemoMutation = useMutation({
    mutationFn: api.resetDemo,
    onSuccess: (data) => {
      toast(data.message, "success");
      refetchIncidents();
      refetchMemory();
    },
    onError: (err: any) => {
      toast(`Reset failed: ${err.message}`, "error");
    },
  });

  const openIncidentsCount = incidents.filter((i) => i.status === "OPEN").length;

  return (
    <AppShell
      currentTab={currentTab}
      onTabChange={setCurrentTab}
      openIncidentsCount={openIncidentsCount}
      memoryEntriesCount={memoryEntries.length}
      health={health || null}
      onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      onResetDemo={() => resetDemoMutation.mutate()}
      isDark={isDark}
      onToggleTheme={() => setIsDark(!isDark)}
    >
      {currentTab === "incidents" && (
        <IncidentsView
          incidents={incidents}
          selectedIncident={selectedIncident}
          onSelectIncident={setSelectedIncident}
          onRefreshIncidents={() => {
            refetchIncidents();
            refetchMemory();
          }}
        />
      )}

      {currentTab === "memory" && <MemoryView />}

      {currentTab === "insights" && <InsightsView />}

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        incidents={incidents}
        onSelectIncident={(inc) => {
          setSelectedIncident(inc);
          setCurrentTab("incidents");
        }}
        onNavigate={setCurrentTab}
        onResetDemo={() => resetDemoMutation.mutate()}
      />
    </AppShell>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RecurApp />
      </ToastProvider>
    </QueryClientProvider>
  );
}
