import { useRef, useState } from "react";
import { FileText, Play, RotateCcw, Upload, X } from "lucide-react";
import { getAuthHeaders } from "../keyStore";
import type { SingleInspectResponse, TrackResult } from "../types";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

interface TrackCardMeta {
  key: "ml" | "decision" | "llm";
  title: string;
  subtitle: string;
  badgeColor: string;
}

const CARD_CONFIGS: TrackCardMeta[] = [
  {
    key: "ml",
    title: "Classical ML · SVM",
    subtitle: "Dual-Head Calibrated LinearSVC",
    badgeColor: "text-ink",
  },
  {
    key: "decision",
    title: "Decisions API · decision-1",
    subtitle: "Single Prefill Pass · 0 Output Tokens",
    badgeColor: "text-gdgBlue",
  },
  {
    key: "llm",
    title: "Generative LLM · gemini-3.8-flash",
    subtitle: "Vertex AI Structured JSON (thinking: low)",
    badgeColor: "text-gdgAmber",
  },
];

function formatBool(v: boolean | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v ? "true" : "false";
}

function ResultCard({
  meta,
  loading,
  data,
}: {
  meta: TrackCardMeta;
  loading: boolean;
  data: TrackResult | null;
}) {
  return (
    <article className="brutal-card flex min-w-0 flex-col justify-between p-3.5 sm:p-4">
      <div>
        <div className="flex items-start justify-between gap-2 border-b-2 border-ink pb-3">
          <div>
            <h2 className={`font-display text-base font-bold ${meta.badgeColor}`}>
              {meta.title}
            </h2>
            <p className="text-xs text-inkSecondary">{meta.subtitle}</p>
          </div>
          <span className="border border-ink bg-mutedSurface px-2 py-0.5 font-mono text-[11px] font-bold uppercase text-ink">
            {loading ? "RUNNING" : data ? (data.status === "ok" ? "DONE" : "ERROR") : "IDLE"}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 border-b border-zinc-200 pb-3 font-mono text-xs tabular-nums">
          <div>
            <div className="text-[10px] font-semibold uppercase text-inkSecondary">RTT</div>
            <div className="font-bold text-ink">
              {loading ? "..." : data ? `${data.rtt_ms.toFixed(1)} ms` : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-inkSecondary">Out Tok</div>
            <div className="font-bold text-ink">
              {loading ? "..." : data ? data.output_tokens : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-inkSecondary">$/1M Req</div>
            <div className="font-bold text-ink">
              {loading ? "..." : data ? `$${data.est_cost_per_1m_usd.toFixed(2)}` : "—"}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-3 space-y-2">
            <div className="h-4 w-3/4 animate-pulse bg-mutedSurface" />
            <div className="h-4 w-1/2 animate-pulse bg-mutedSurface" />
            <div className="h-4 w-2/3 animate-pulse bg-mutedSurface" />
          </div>
        ) : data?.status === "error" ? (
          <div className="mt-3 border-2 border-gdgRed bg-red-50 p-2.5 font-mono text-xs text-gdgRed">
            {data.error_message || "API request failed"}
          </div>
        ) : (
          <dl className="mt-3 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-inkSecondary">route_target</dt>
              <dd className="font-bold text-ink">{data?.route_target ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-inkSecondary">target_mcp_tool</dt>
              <dd className="font-semibold text-ink">{data?.target_mcp_tool ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-inkSecondary">is_prompt_injection</dt>
              <dd
                className={`font-semibold ${
                  data?.is_prompt_injection ? "text-gdgRed" : "text-ink"
                }`}
              >
                {data ? formatBool(data.is_prompt_injection) : "—"}
                {data?.p_injection !== undefined && data?.p_injection !== null
                  ? ` (${data.p_injection.toFixed(2)})`
                  : ""}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-inkSecondary">is_in_scope</dt>
              <dd className="text-ink">
                {data ? formatBool(data.is_in_scope) : "—"}
                {data?.p_in_scope !== undefined && data?.p_in_scope !== null
                  ? ` (${data.p_in_scope.toFixed(2)})`
                  : ""}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-inkSecondary">risk_severity</dt>
              <dd className="text-ink">
                {data?.risk_severity !== null && data?.risk_severity !== undefined
                  ? `${data.risk_severity} / 4`
                  : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-inkSecondary">confidence</dt>
              <dd
                className={`font-bold tabular-nums ${
                  data?.confidence !== null && data?.confidence !== undefined
                    ? data.confidence >= 0.9
                      ? "text-gdgGreen"
                      : "text-gdgAmber"
                    : "text-ink"
                }`}
              >
                {data?.confidence !== null && data?.confidence !== undefined
                  ? data.confidence.toFixed(3)
                  : "—"}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </article>
  );
}

export function ReflexStudio() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SingleInspectResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const attachFile = (candidate: File | null) => {
    setErrorMsg(null);
    if (!candidate) return;
    if (!ALLOWED_MIME.has(candidate.type)) {
      setErrorMsg("Unsupported file type. Allowed: PNG, JPG, WEBP, PDF.");
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setErrorMsg("File exceeds 5 MB limit.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(candidate);
    if (candidate.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(candidate));
    } else {
      setPreviewUrl(null);
    }
  };

  const clearAll = () => {
    setText("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAnalyze = async () => {
    if (!text.trim() && !file) {
      setErrorMsg("Paste request text or drop an image/PDF before analyzing.");
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("text", text);
      if (file) formData.append("file", file);

      const resp = await fetch("/api/decide/single", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail || "Request failed");
      }
      const data: SingleInspectResponse = await resp.json();
      setResults(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to analyze request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="panel-studio"
      role="tabpanel"
      aria-labelledby="tab-studio"
      className="space-y-6"
    >
      <div className="brutal-card p-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label
              htmlFor="payload-textarea"
              className="mb-2 block font-display text-xs font-bold uppercase tracking-wider text-inkSecondary"
            >
              Request Payload (Text / Indirect Injection / OOS)
            </label>
            <textarea
              id="payload-textarea"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste or type request payload here..."
              className="w-full border-2 border-ink bg-white p-3 font-mono text-xs text-ink placeholder:text-zinc-400"
            />
          </div>

          <div className="flex flex-col">
            <span className="mb-2 block font-display text-xs font-bold uppercase tracking-wider text-inkSecondary">
              Multimodal Attachment (PNG / JPG / WEBP / PDF · &lt; 5 MB)
            </span>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const dropped = e.dataTransfer.files?.[0] ?? null;
                attachFile(dropped);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-1 cursor-pointer flex-col items-center justify-center border-2 border-dashed border-ink p-4 text-center transition ${
                dragActive ? "bg-amber-50" : "bg-mutedSurface hover:bg-white"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.pdf"
                className="hidden"
                onChange={(e) => attachFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex w-full flex-col items-center gap-2">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="max-h-24 border border-ink object-contain"
                    />
                  ) : (
                    <FileText className="h-8 w-8 text-ink" />
                  )}
                  <div className="flex items-center gap-2 font-mono text-xs font-semibold text-ink">
                    <span className="max-w-[180px] truncate">{file.name}</span>
                    <button
                      type="button"
                      aria-label="Remove attached file"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setFile(null);
                        setPreviewUrl(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="border border-ink bg-white p-0.5 hover:bg-red-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="mx-auto h-6 w-6 text-inkSecondary" />
                  <p className="text-xs font-semibold text-ink">
                    Drop scanned image or PDF here
                  </p>
                  <p className="font-mono text-[11px] text-inkSecondary">
                    or click to browse
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-3 border-2 border-gdgRed bg-red-50 px-3 py-2 font-mono text-xs font-semibold text-gdgRed">
            {errorMsg}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={clearAll}
            disabled={loading}
            className="brutal-btn flex items-center gap-1.5 border-2 border-ink bg-mutedSurface px-4 py-2 font-display text-xs font-bold text-ink transition hover:bg-white disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </button>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading}
            className="brutal-btn flex items-center gap-2 border-2 border-ink bg-fptu px-5 py-2 font-display text-xs font-bold text-ink shadow-brutalSm transition hover:brightness-105 disabled:opacity-60"
          >
            <Play className="h-3.5 w-3.5 fill-ink" />
            {loading ? "Analyzing..." : "Analyze Request"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {CARD_CONFIGS.map((cfg) => (
          <ResultCard
            key={cfg.key}
            meta={cfg}
            loading={loading}
            data={results ? results[cfg.key] : null}
          />
        ))}
      </div>
    </section>
  );
}
