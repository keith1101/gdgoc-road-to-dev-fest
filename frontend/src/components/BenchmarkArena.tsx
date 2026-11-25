import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Play, Square, Trash2 } from "lucide-react";
import { getAuthHeaders } from "../keyStore";
import type {
  ArenaSnapshot,
  SampleInitMeta,
  StreamSampleEvent,
  TrackName,
  TrackSummary,
  WaterfallRow,
} from "../types";
import { ArenaCharts } from "./ArenaCharts";
import { WaterfallTable } from "./WaterfallTable";

const STORAGE_KEY = "gdgoc_devfest_arena_v1";
const PRICING: Record<TrackName, { inRate: number; outRate: number }> = {
  ml: { inRate: 0, outRate: 0 },
  decision: { inRate: 0.1, outRate: 0 },
  llm: { inRate: 0.75, outRate: 3.75 },
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(Math.max(0, Math.ceil(p * sorted.length) - 1), sorted.length - 1);
  return Number(sorted[idx].toFixed(2));
}

function computeLiveSummary(
  track: TrackName,
  rows: WaterfallRow[],
  total: number
): TrackSummary | undefined {
  const events = rows
    .map((r) => r[track])
    .filter((ev): ev is StreamSampleEvent => Boolean(ev));
  if (events.length === 0) return undefined;

  const okEvents = events.filter((e) => e.result.status === "ok");
  const errEvents = events.filter((e) => e.result.status !== "ok");
  const completed = okEvents.length;

  if (completed === 0) {
    return {
      track,
      completed: 0,
      errors: errEvents.length,
      total,
      accuracy_all: 0,
      accuracy_text: null,
      accuracy_complex: null,
      tool_accuracy: 0,
      p50_ms: 0,
      p95_ms: 0,
      total_wall_ms: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_thought_tokens: 0,
      avg_output_tokens: 0,
      est_cost_per_1m_usd: 0,
      retries_503: events.reduce((acc, e) => acc + (e.result.retries_503 || 0), 0),
      retries_429: events.reduce((acc, e) => acc + (e.result.retries_429 || 0), 0),
      ece_5bin: null,
      brier_score: null,
      escalated_count: 0,
      escalated_pct: 0,
    };
  }

  const textEv = okEvents.filter((e) => e.sample_id.startsWith("tobi_"));
  const complexEv = okEvents.filter((e) => !e.sample_id.startsWith("tobi_"));
  const lats = okEvents.map((e) => e.result.rtt_ms).sort((a, b) => a - b);

  const sumIn = okEvents.reduce((a, e) => a + e.result.input_tokens, 0);
  const sumOut = okEvents.reduce((a, e) => a + e.result.output_tokens, 0);
  const sumThought = okEvents.reduce((a, e) => a + e.result.thought_tokens, 0);
  const { inRate, outRate } = PRICING[track];
  const cost = (sumIn * inRate + (sumOut + sumThought) * outRate) / completed;
  const escalated = okEvents.filter(
    (e) => e.result.confidence !== null && e.result.confidence !== undefined && e.result.confidence < 0.9
  ).length;

  return {
    track,
    completed,
    errors: errEvents.length,
    total,
    accuracy_all: Number(
      ((okEvents.filter((e) => e.action_correct).length / completed) * 100).toFixed(1)
    ),
    accuracy_text:
      textEv.length > 0
        ? Number(((textEv.filter((e) => e.action_correct).length / textEv.length) * 100).toFixed(1))
        : null,
    accuracy_complex:
      complexEv.length > 0
        ? Number(
            ((complexEv.filter((e) => e.action_correct).length / complexEv.length) * 100).toFixed(1)
          )
        : null,
    tool_accuracy: Number(
      ((okEvents.filter((e) => e.tool_correct).length / completed) * 100).toFixed(1)
    ),
    p50_ms: percentile(lats, 0.5),
    p95_ms: percentile(lats, 0.95),
    total_wall_ms: 0,
    total_input_tokens: sumIn,
    total_output_tokens: sumOut,
    total_thought_tokens: sumThought,
    avg_output_tokens: Number(((sumOut + sumThought) / completed).toFixed(1)),
    est_cost_per_1m_usd: Number(cost.toFixed(2)),
    retries_503: events.reduce((a, e) => a + (e.result.retries_503 || 0), 0),
    retries_429: events.reduce((a, e) => a + (e.result.retries_429 || 0), 0),
    ece_5bin: null,
    brier_score: null,
    escalated_count: escalated,
    escalated_pct: Number(((escalated / completed) * 100).toFixed(1)),
  };
}

export function BenchmarkArena() {
  const [limit, setLimit] = useState<5 | 10 | 20 | 100>(10);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<WaterfallRow[]>([]);
  const [summaries, setSummaries] = useState<Partial<Record<TrackName, TrackSummary>>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: ArenaSnapshot = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.rows) && parsed.rows.length > 0) {
          setLimit(parsed.limit);
          setRows(parsed.rows);
          setSummaries(parsed.summaries || {});
        }
      }
    } catch {
      // Ignore malformed localStorage
    }
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const persistSnapshot = (
    nextLimit: 5 | 10 | 20 | 100,
    nextRows: WaterfallRow[],
    nextSummaries: Partial<Record<TrackName, TrackSummary>>
  ) => {
    if (nextRows.length === 0) return;
    try {
      const snap: ArenaSnapshot = {
        limit: nextLimit,
        updatedAt: new Date().toISOString(),
        rows: nextRows,
        summaries: nextSummaries,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
    } catch {
      // Ignore storage quota errors
    }
  };

  const stopRun = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  };

  const clearSnapshot = () => {
    stopRun();
    localStorage.removeItem(STORAGE_KEY);
    setRows([]);
    setSummaries({});
    setErrorMsg(null);
  };

  const startRun = async () => {
    stopRun();
    setErrorMsg(null);
    setRunning(true);
    setRows([]);
    setSummaries({});

    const controller = new AbortController();
    abortRef.current = controller;

    let currentRows: WaterfallRow[] = [];
    let currentSummaries: Partial<Record<TrackName, TrackSummary>> = {};
    let currentTotal: number = limit;

    const handleSseEvent = (eventName: string, dataText: string) => {
      if (eventName === "init") {
        const data = JSON.parse(dataText) as {
          total: number;
          samples: SampleInitMeta[];
        };
        currentTotal = data.total;
        currentRows = data.samples.map((meta) => ({ meta }));
        setRows(currentRows);
      } else if (eventName === "result") {
        const item = JSON.parse(dataText) as StreamSampleEvent;
        currentRows = currentRows.map((row, idx) =>
          idx === item.index ? { ...row, [item.track]: item } : row
        );
        const liveSum = computeLiveSummary(item.track, currentRows, currentTotal);
        if (liveSum) {
          currentSummaries = { ...currentSummaries, [item.track]: liveSum };
        }
        setRows(currentRows);
        setSummaries(currentSummaries);
        persistSnapshot(limit, currentRows, currentSummaries);
      } else if (eventName === "track_done") {
        const sum = JSON.parse(dataText) as TrackSummary;
        currentSummaries = { ...currentSummaries, [sum.track]: sum };
        setSummaries(currentSummaries);
        persistSnapshot(limit, currentRows, currentSummaries);
      } else if (eventName === "complete") {
        const data = JSON.parse(dataText) as {
          summaries: Record<TrackName, TrackSummary>;
        };
        currentSummaries = data.summaries;
        setSummaries(currentSummaries);
        persistSnapshot(limit, currentRows, currentSummaries);
      }
    };

    try {
      const resp = await fetch(`/api/benchmark/stream?limit=${limit}`, {
        method: "POST",
        headers: getAuthHeaders(),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          if (!chunk.trim() || chunk.startsWith(":")) continue;
          let evName = "message";
          let dataStr = "";
          for (const line of chunk.split("\n")) {
            if (line.startsWith("event: ")) evName = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr += line.slice(6);
          }
          if (dataStr) {
            handleSseEvent(evName, dataStr);
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setErrorMsg(err instanceof Error ? err.message : "SSE stream failed.");
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  };

  const kpiCards: {
    track: TrackName;
    title: string;
    accent: string;
  }[] = [
    { track: "ml", title: "Classical ML · Dual-Head SVM", accent: "text-ink" },
    { track: "decision", title: "Decisions API · gemini-decision-1", accent: "text-gdgBlue" },
    { track: "llm", title: "Generative LLM · gemini-3.8-flash", accent: "text-gdgAmber" },
  ];

  const totalCount = rows.length || limit;

  return (
    <section
      id="panel-arena"
      role="tabpanel"
      aria-labelledby="tab-arena"
      className="space-y-5"
    >
      <div className="brutal-card flex flex-col gap-3 p-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-xs font-bold uppercase tracking-wider text-inkSecondary">
            Batch Size
          </span>
          <div className="flex border-2 border-ink bg-mutedSurface">
            {([5, 10, 20, 100] as const).map((n) => (
              <button
                key={n}
                type="button"
                disabled={running}
                onClick={() => setLimit(n)}
                className={`px-3.5 py-1.5 font-mono text-xs font-bold transition ${
                  n !== 5 ? "border-l-2 border-ink" : ""
                } ${
                  limit === n
                    ? n === 100
                      ? "bg-amber-600 text-white"
                      : "bg-ink text-white"
                    : "text-ink hover:bg-white disabled:opacity-50"
                }`}
              >
                {n}
                {n === 10 ? "*" : n === 100 ? " !" : ""}
              </button>
            ))}
          </div>
          <span className="hidden font-mono text-xs text-inkSecondary md:inline">
            {limit === 100
              ? "Full 100-sample HF evaluation (20 per action class)"
              : "Balanced 4-source Hugging Face slice"}
          </span>
        </div>

        <div className="flex w-full items-center gap-2.5 sm:w-auto sm:justify-end sm:gap-3">
          {rows.length > 0 && !running && (
            <button
              type="button"
              onClick={clearSnapshot}
              className="brutal-btn flex items-center justify-center gap-1.5 border-2 border-ink bg-mutedSurface px-3 py-2 font-display text-xs font-bold text-ink hover:bg-white"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={running ? stopRun : startRun}
            className={`brutal-btn flex flex-1 items-center justify-center gap-2 border-2 border-ink px-5 py-2 font-display text-xs font-bold shadow-brutalSm transition sm:flex-initial ${
              running
                ? "bg-gdgRed text-white hover:brightness-110"
                : "bg-fptu text-ink hover:brightness-105"
            }`}
          >
            {running ? (
              <>
                <Square className="h-3.5 w-3.5 fill-white" />
                ABORT
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-ink" />
                RUN BENCHMARK
              </>
            )}
          </button>
        </div>
      </div>

      {limit === 100 && (
        <div
          role="alert"
          className="flex items-start gap-2.5 border-2 border-amber-700 bg-amber-50 px-4 py-3 font-mono text-xs text-amber-950"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <span className="font-bold">Batch N = 100 Notice:</span> Running 100 samples including
            12 scanned images (<code className="font-semibold">RapidOCR</code>) and 100{" "}
            <code className="font-semibold">gemini-3.8-flash</code> calls takes{" "}
            <span className="font-bold">~4–8 min</span> and ~100K input tokens/track.
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="border-2 border-gdgRed bg-red-50 px-4 py-2 font-mono text-xs font-semibold text-gdgRed">
          {errorMsg}
        </div>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {kpiCards.map((c) => {
            const sum = summaries[c.track];
            const done = (sum?.completed ?? 0) + (sum?.errors ?? 0);
            const pct = Math.round((done / totalCount) * 100);
            return (
              <div key={c.track} className="min-w-0 border-2 border-ink bg-surface px-3 py-2 font-mono text-xs">
                <div className="flex items-center justify-between gap-2 font-bold">
                  <span className={`truncate ${c.accent}`}>{c.title}</span>
                  <span className="shrink-0 tabular-nums">
                    {done}/{totalCount}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full border border-ink bg-mutedSurface">
                  <div
                    className="h-full bg-ink transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {kpiCards.map((c, idx) => {
          const s = summaries[c.track];
          return (
            <article
              key={c.track}
              className={`brutal-card min-w-0 p-3.5 sm:p-4 ${
                idx === 2 ? "md:col-span-2 lg:col-span-1" : ""
              }`}
            >
              <h2 className={`truncate border-b-2 border-ink pb-2 font-display text-sm font-bold ${c.accent}`}>
                {c.title}
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-xs tabular-nums">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase text-inkSecondary">
                    Accuracy (All / Tool)
                  </div>
                  <div className="text-sm font-bold text-ink sm:text-base">
                    {s ? `${s.accuracy_all.toFixed(1)}% / ${s.tool_accuracy.toFixed(1)}%` : "—"}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase text-inkSecondary">
                    Cost / 1M Req
                  </div>
                  <div className="text-sm font-bold text-ink sm:text-base">
                    {s ? `$${s.est_cost_per_1m_usd.toFixed(2)}` : "—"}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase text-inkSecondary">
                    p50 / p95 RTT
                  </div>
                  <div className="font-bold text-ink">
                    {s ? `${s.p50_ms.toFixed(1)} / ${s.p95_ms.toFixed(1)} ms` : "—"}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase text-inkSecondary">
                    Out Tok · 503 Retries
                  </div>
                  <div className="font-bold text-ink">
                    {s ? `${s.avg_output_tokens} · ${s.retries_503}` : "—"}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase text-inkSecondary">
                    Text vs Complex
                  </div>
                  <div className="font-semibold text-ink">
                    {s
                      ? `${s.accuracy_text !== null ? `${s.accuracy_text}%` : "—"} vs ${
                          s.accuracy_complex !== null ? `${s.accuracy_complex}%` : "—"
                        }`
                      : "—"}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase text-inkSecondary">
                    Boundary (&lt;0.90) · ECE
                  </div>
                  <div className="font-semibold text-ink">
                    {s
                      ? `${s.escalated_pct}% · ${
                          s.ece_5bin !== null ? s.ece_5bin.toFixed(3) : "—"
                        }`
                      : "—"}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <ArenaCharts summaries={summaries} />

      <WaterfallTable rows={rows} />
    </section>
  );
}
