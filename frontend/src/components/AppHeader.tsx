import { KeyRound, RefreshCw } from "lucide-react";

export type TabKey = "studio" | "arena";

interface AppHeaderProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  pingState: {
    loading: boolean;
    ok: boolean | null;
    needsKey?: boolean;
    rttMs: number | null;
  };
  hasKeys: boolean;
  onOpenKeys: () => void;
  onRePing: () => void;
}

export function AppHeader({
  activeTab,
  onTabChange,
  pingState,
  hasKeys,
  onOpenKeys,
  onRePing,
}: AppHeaderProps) {
  return (
    <header className="border-b-2 border-ink bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/gdgoc-logo.png"
              alt="Google Developer Groups On Campus · FPT University HCMC"
              className="h-10 w-10 shrink-0 rounded-full border-2 border-ink bg-white object-contain sm:h-11 sm:w-11"
            />
            <div className="min-w-0">
              <h1 className="truncate font-display text-sm font-bold tracking-tight text-ink sm:text-lg">
                ML vs Decisions API vs LLM · Control Plane Benchmark
              </h1>
              <p className="truncate text-[11px] font-medium text-inkSecondary sm:text-xs">
                GDGoC FPTU HCM · Road to DevFest 2026
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onOpenKeys}
            className={`brutal-btn flex items-center gap-1.5 border-2 border-ink px-3 py-1.5 font-mono text-xs font-bold text-ink transition ${
              hasKeys ? "bg-emerald-50 hover:bg-emerald-100" : "bg-amber-100 hover:bg-amber-200"
            }`}
            title="Configure session API keys (BYOK)"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>{hasKeys ? "KEYS SET" : "SET KEYS"}</span>
          </button>

          <button
            type="button"
            onClick={pingState.needsKey ? onOpenKeys : onRePing}
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
                  : pingState.needsKey
                  ? "bg-amber-500"
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
                : pingState.needsKey
                ? "NO KEY"
                : pingState.ok === false
                ? "API ERROR"
                : "READY"}
            </span>
            <RefreshCw className={`h-3 w-3 ${pingState.loading ? "animate-spin" : ""}`} />
          </button>

          <nav
            role="tablist"
            aria-label="Console Modes"
            className="grid w-full grid-cols-2 border-2 border-ink bg-mutedSurface sm:flex sm:w-auto"
          >
            <button
              type="button"
              role="tab"
              id="tab-studio"
              aria-selected={activeTab === "studio"}
              aria-controls="panel-studio"
              onClick={() => onTabChange("studio")}
              className={`px-3 py-1.5 text-center font-display text-xs font-bold transition sm:px-3.5 sm:text-sm ${
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
              className={`border-l-2 border-ink px-3 py-1.5 text-center font-display text-xs font-bold transition sm:px-3.5 sm:text-sm ${
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
