import type { StreamSampleEvent, WaterfallRow } from "../types";

interface WaterfallTableProps {
  rows: WaterfallRow[];
}

function TrackCell({ ev }: { ev?: StreamSampleEvent }) {
  if (!ev) {
    return <span className="font-mono text-xs text-zinc-400">—</span>;
  }
  const r = ev.result;
  if (r.status === "error") {
    return (
      <div className="space-y-0.5 font-mono text-[11px]">
        <span className="inline-block border border-gdgRed bg-red-50 px-1.5 py-0.5 font-bold text-gdgRed">
          ERROR
        </span>
        {r.retries_503 > 0 && (
          <span className="ml-1 inline-block border border-gdgAmber bg-amber-50 px-1 py-0.5 text-[10px] font-bold text-gdgAmber">
            503×{r.retries_503}
          </span>
        )}
        <div className="break-all text-gdgRed sm:max-w-[200px] sm:truncate" title={r.error_message ?? ""}>
          {r.error_message || "API failure"}
        </div>
      </div>
    );
  }

  const ok = ev.action_correct;
  return (
    <div className="space-y-0.5 font-mono text-[11px] tabular-nums">
      <div className="flex flex-wrap items-center gap-1">
        <span
          className={`inline-block border px-1.5 py-0.5 text-[10px] font-bold ${
            ok
              ? "border-gdgGreen bg-emerald-50 text-gdgGreen"
              : "border-gdgRed bg-red-50 text-gdgRed"
          }`}
        >
          {ok ? "OK" : "MISS"}
        </span>
        <span className="font-semibold text-ink">{r.route_target}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-inkSecondary">
        <span>{r.rtt_ms.toFixed(1)}ms</span>
        {r.confidence !== null && r.confidence !== undefined && (
          <span className={r.confidence < 0.9 ? "font-bold text-gdgAmber" : ""}>
            conf {r.confidence.toFixed(2)}
          </span>
        )}
        <span>out {r.output_tokens}</span>
        {r.retries_503 > 0 && (
          <span className="border border-gdgAmber bg-amber-50 px-1 text-gdgAmber">
            503×{r.retries_503}
          </span>
        )}
      </div>
    </div>
  );
}

export function WaterfallTable({ rows }: WaterfallTableProps) {
  return (
    <div className="brutal-card overflow-hidden">
      <div className="border-b-2 border-ink bg-mutedSurface px-4 py-2.5">
        <h3 className="font-display text-sm font-bold text-ink">
          Live Request Waterfall ({rows.length} Samples)
        </h3>
      </div>
      <div
        className="waterfall-wrap max-h-[420px] overflow-auto"
        role="region"
        aria-label="Live Request Waterfall"
        tabIndex={0}
      >
        <table className="waterfall-table w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 border-b-2 border-ink bg-surface font-display text-xs uppercase text-inkSecondary">
            <tr>
              <th className="px-3 py-2.5">Sample</th>
              <th className="px-3 py-2.5">Type</th>
              <th className="px-3 py-2.5">Ground Truth</th>
              <th className="px-3 py-2.5">ML (SVM)</th>
              <th className="px-3 py-2.5">Decisions API</th>
              <th className="px-3 py-2.5">LLM (3.8-Flash)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-surface text-xs">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center font-mono text-inkSecondary">
                  No benchmark run yet. Select Batch Size and click RUN BENCHMARK.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.meta.id} className="hover:bg-paper/70">
                  <td data-label="Sample" className="px-3 py-2.5 font-mono font-bold text-ink">
                    {row.meta.id}
                  </td>
                  <td data-label="Type" className="px-3 py-2.5 font-mono text-[11px] text-inkSecondary">
                    {row.meta.modality} · {row.meta.difficulty}
                  </td>
                  <td data-label="Ground Truth" className="px-3 py-2.5 font-mono text-[11px]">
                    <div className="font-bold text-ink">{row.meta.ground_truth}</div>
                    <div className="text-[10px] text-inkSecondary">{row.meta.expected_tool}</div>
                  </td>
                  <td data-label="ML (SVM)" className="px-3 py-2.5">
                    <TrackCell ev={row.ml} />
                  </td>
                  <td data-label="Decisions API" className="px-3 py-2.5">
                    <TrackCell ev={row.decision} />
                  </td>
                  <td data-label="LLM (3.8-Flash)" className="px-3 py-2.5">
                    <TrackCell ev={row.llm} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
