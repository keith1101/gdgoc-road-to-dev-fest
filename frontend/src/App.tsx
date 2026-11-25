import { useCallback, useEffect, useState } from "react";
import { AppHeader, type TabKey } from "./components/AppHeader";
import { BenchmarkArena } from "./components/BenchmarkArena";
import { ReflexStudio } from "./components/ReflexStudio";

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("studio");
  const [pingState, setPingState] = useState<{
    loading: boolean;
    ok: boolean | null;
    rttMs: number | null;
  }>({ loading: true, ok: null, rttMs: null });

  const runPing = useCallback(async () => {
    setPingState((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch("/api/ping");
      const data = await res.json();
      setPingState({
        loading: false,
        ok: Boolean(data.ok),
        rttMs: typeof data.rtt_ms === "number" ? data.rtt_ms : null,
      });
    } catch {
      setPingState({ loading: false, ok: false, rttMs: null });
    }
  }, []);

  useEffect(() => {
    runPing();
  }, [runPing]);

  return (
    <div className="min-h-screen">
      <AppHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pingState={pingState}
        onRePing={runPing}
      />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === "studio" ? <ReflexStudio /> : <BenchmarkArena />}
      </main>
    </div>
  );
}

export default App;
