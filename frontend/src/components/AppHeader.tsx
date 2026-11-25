import { RefreshCw } from "lucide-react";

export type TabKey = "studio" | "arena";

interface AppHeaderProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  pingState: {
    loading: boolean;
    ok: boolean | null;
    rttMs: number | null;
  };
  onRePing: () => void;
}

export function AppHeader({
  activeTab,
  onTabChange,
  pingState,
  onRePing,
}: AppHeaderProps) {
  return (
    <header className="border-b-2 border-ink bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <img
            src="/gdgoc-logo.png"
            alt="Google Developer Groups On Campus · FPT University HCMC"
            className="h-11 w-11 shrink-0 rounded-full border-2 border-ink bg-white object-contain"
          />
          <div>
            <h1 className="font-display text-base font-bold tracking-tight text-ink sm:text-lg">
              ML vs Decisions API vs LLM · Control Plane Benchmark
            </h1>
            <p className="text-xs font-medium text-inkSecondary">
              GDGoC FPTU HCM · Road to DevFest 2026
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRePing}
            disabled={pingState.loading}
            className="brutal-btn flex items-center gap-2 border-2 border-ink bg-mutedSurface px-3 py-1.5 font-mono text-xs font-semibold text-ink transition hover:bg-white disabled:opacity-60"
            title="Re-ping Gemini Decisions API (/api/ping)"
          >
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full border border-ink ${
                pingState.loading
                  ? "animate-pulse bg-amber-400"
                  : pingState.ok
                  ? "bg-gdgGreen"
                  : pingState.ok === false
                  ? "bg-gdgRed"
                  : "bg-zinc-400"
              }`}
            />
            <span className="tabular-nums">
              {pingState.loading
                ? "PING..."
                : pingState.ok
                ? `LIVE · ${Math.round(pingState.rttMs ?? 0)}ms`
                : pingState.ok === false
                ? "API ERROR"
                : "READY"}
            </span>
            <RefreshCw className={`h-3 w-3 ${pingState.loading ? "animate-spin" : ""}`} />
          </button>

          <nav
            role="tablist"
            aria-label="Console Modes"
            className="flex items-center border-2 border-ink bg-mutedSurface"
          >
            <button
              type="button"
              role="tab"
              id="tab-studio"
              aria-selected={activeTab === "studio"}
              aria-controls="panel-studio"
              onClick={() => onTabChange("studio")}
              className={`px-3.5 py-1.5 font-display text-xs font-bold transition sm:text-sm ${
                activeTab === "studio"
                  ? "border-b-[3px] border-ink bg-white text-ink"
                  : "text-inkSecondary hover:bg-white/60 hover:text-ink"
              }`}
            >
              1. Reflex Studio
            </button>
            <button
              type="button"
              role="tab"
              id="tab-arena"
              aria-selected={activeTab === "arena"}
              aria-controls="panel-arena"
              onClick={() => onTabChange("arena")}
              className={`border-l-2 border-ink px-3.5 py-1.5 font-display text-xs font-bold transition sm:text-sm ${
                activeTab === "arena"
                  ? "border-b-[3px] border-ink bg-white text-ink"
                  : "text-inkSecondary hover:bg-white/60 hover:text-ink"
              }`}
            >
              2. Benchmark Arena
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
