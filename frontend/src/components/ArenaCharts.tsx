import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { TrackName, TrackSummary } from "../types";

interface ArenaChartsProps {
  summaries: Partial<Record<TrackName, TrackSummary>>;
}

const TRACK_LABELS: Record<TrackName, string> = {
  ml: "SVM",
  decision: "Decision-1",
  llm: "3.8-Flash",
};

const TRACK_COLORS: Record<TrackName, string> = {
  ml: "#18181B",
  decision: "#1A73E8",
  llm: "#B45309",
};

export function ArenaCharts({ summaries }: ArenaChartsProps) {
  const tracks: TrackName[] = ["ml", "decision", "llm"];

  const latencyData = tracks.map((t) => {
    const s = summaries[t];
    return {
      name: TRACK_LABELS[t],
      p50: s?.p50_ms ?? 0,
      p95: s?.p95_ms ?? 0,
      avgOut: s?.avg_output_tokens ?? 0,
    };
  });

  const accuracyData = tracks.map((t) => {
    const s = summaries[t];
    return {
      name: TRACK_LABELS[t],
      standardText: s?.accuracy_text ?? 0,
      complexData: s?.accuracy_complex ?? 0,
    };
  });

  const paretoData = tracks
    .filter((t) => (summaries[t]?.completed ?? 0) > 0)
    .map((t) => {
      const s = summaries[t]!;
      return {
        name: TRACK_LABELS[t],
        track: t,
        cost: s.est_cost_per_1m_usd,
        accuracy: s.accuracy_all,
        p50: s.p50_ms,
      };
    });

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div className="brutal-card min-w-0 p-3 sm:p-4">
        <h3 className="font-display text-sm font-bold text-ink">
          1. Latency p50 / p95 (ms)
        </h3>
        <p className="mb-3 text-xs text-inkSecondary">
          Dynamic Y-axis · Tooltip shows Avg Output Tokens
        </p>
        <div className="h-56 w-full min-w-0 sm:h-60">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={latencyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#18181B" }} />
              <YAxis width={42} domain={[0, "auto"]} tick={{ fontSize: 10, fill: "#52525B" }} />
              <Tooltip
                contentStyle={{
                  border: "2px solid #18181B",
                  borderRadius: 0,
                  fontSize: "12px",
                  fontFamily: "JetBrains Mono, monospace",
                }}
                formatter={(val, name, props) => {
                  const avgOut = (props?.payload as { avgOut?: number })?.avgOut ?? 0;
                  return [`${Number(val).toFixed(1)} ms (out tok: ${avgOut})`, String(name)];
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="p50" name="p50 (ms)" fill="#1A73E8" />
              <Bar dataKey="p95" name="p95 (ms)" fill="#18181B" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="brutal-card min-w-0 p-3 sm:p-4">
        <h3 className="font-display text-sm font-bold text-ink">
          2. Accuracy: Standard Text vs Complex Data (%)
        </h3>
        <p className="mb-3 text-xs text-inkSecondary">
          In-Domain Tickets vs Injection / OOS / Scanned Images
        </p>
        <div className="h-56 w-full min-w-0 sm:h-60">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={accuracyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#18181B" }} />
              <YAxis width={38} domain={[0, 100]} tick={{ fontSize: 10, fill: "#52525B" }} />
              <Tooltip
                contentStyle={{
                  border: "2px solid #18181B",
                  borderRadius: 0,
                  fontSize: "12px",
                  fontFamily: "JetBrains Mono, monospace",
                }}
                formatter={(val) => [`${Number(val).toFixed(1)}%`]}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="standardText" name="Standard Text" fill="#137333" />
              <Bar dataKey="complexData" name="Complex Data" fill="#F37021" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="brutal-card min-w-0 p-3 sm:p-4 md:col-span-2 xl:col-span-1">
        <h3 className="font-display text-sm font-bold text-ink">
          3. Pareto: Accuracy (%) vs Cost ($/1M Req)
        </h3>
        <p className="mb-3 text-xs text-inkSecondary">
          Top-Left is Optimal (High Accuracy, Low Cost)
        </p>
        <div className="h-56 w-full min-w-0 sm:h-60">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ScatterChart margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
              <XAxis
                type="number"
                dataKey="cost"
                name="Cost"
                unit="$"
                domain={[0, "auto"]}
                tick={{ fontSize: 10, fill: "#52525B" }}
              />
              <YAxis
                width={42}
                type="number"
                dataKey="accuracy"
                name="Accuracy"
                unit="%"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#52525B" }}
              />
              <ZAxis range={[120, 120]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{
                  border: "2px solid #18181B",
                  borderRadius: 0,
                  fontSize: "12px",
                  fontFamily: "JetBrains Mono, monospace",
                }}
                formatter={(val, name) => {
                  if (name === "Cost") return [`$${Number(val).toFixed(2)} / 1M`, "Cost"];
                  if (name === "Accuracy") return [`${Number(val).toFixed(1)}%`, "Accuracy"];
                  return [String(val), String(name)];
                }}
                labelFormatter={(_, payload) => {
                  const item = payload?.[0]?.payload as { name?: string; p50?: number } | undefined;
                  return item ? `${item.name} (p50: ${item.p50?.toFixed(1)}ms)` : "";
                }}
              />
              <Scatter name="Models" data={paretoData}>
                {paretoData.map((entry) => (
                  <Cell key={entry.track} fill={TRACK_COLORS[entry.track]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
