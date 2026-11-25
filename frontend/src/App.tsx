import { useCallback, useEffect, useState } from "react";
import { ApiKeysModal } from "./components/ApiKeysModal";
import { AppHeader, type TabKey } from "./components/AppHeader";
import { BenchmarkArena } from "./components/BenchmarkArena";
import { ReflexStudio } from "./components/ReflexStudio";
import {
  clearByokConfig,
  getAuthHeaders,
  loadByokConfig,
  saveByokConfig,
  type ByokConfig,
} from "./keyStore";

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("studio");
  const [byok, setByok] = useState<ByokConfig>(() => loadByokConfig());
  const [keysOpen, setKeysOpen] = useState(false);
  const [pingState, setPingState] = useState<{
    loading: boolean;
    ok: boolean | null;
    needsKey?: boolean;
    rttMs: number | null;
  }>({ loading: true, ok: null, needsKey: false, rttMs: null });

  const runPing = useCallback(async () => {
    setPingState((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch("/api/ping", {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setPingState({
        loading: false,
        ok: Boolean(data.ok),
        needsKey: Boolean(data.needs_key),
        rttMs: typeof data.rtt_ms === "number" ? data.rtt_ms : null,
      });
    } catch {
      setPingState({ loading: false, ok: false, needsKey: false, rttMs: null });
    }
  }, []);

  useEffect(() => {
    runPing();
  }, [runPing]);

  const hasKeys = Boolean(byok.geminiApiKey.trim() || byok.vertexSaJsonB64.trim());

  return (
    <div className="min-h-screen overflow-x-hidden">
      <AppHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pingState={pingState}
        hasKeys={hasKeys}
        onOpenKeys={() => setKeysOpen(true)}
        onRePing={runPing}
      />
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        {activeTab === "studio" ? <ReflexStudio /> : <BenchmarkArena />}
      </main>
      <ApiKeysModal
        open={keysOpen}
        initialConfig={byok}
        onClose={() => setKeysOpen(false)}
        onSave={(next) => {
          saveByokConfig(next);
          setByok(next);
          runPing();
        }}
        onClear={() => {
          clearByokConfig();
          const cleared = loadByokConfig();
          setByok(cleared);
          runPing();
        }}
      />
    </div>
  );
}

export default App;
