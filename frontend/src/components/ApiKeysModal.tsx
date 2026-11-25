import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, FileKey2, KeyRound, Trash2, Upload, X } from "lucide-react";
import {
  EMPTY_BYOK,
  encodeUtf8ToBase64,
  type ByokConfig,
} from "../keyStore";

interface ApiKeysModalProps {
  open: boolean;
  initialConfig: ByokConfig;
  onClose: () => void;
  onSave: (next: ByokConfig) => void;
  onClear: () => void;
}

export function ApiKeysModal({
  open,
  initialConfig,
  onClose,
  onSave,
  onClear,
}: ApiKeysModalProps) {
  const [draft, setDraft] = useState<ByokConfig>(initialConfig);
  const [showKey, setShowKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initialConfig);
      setErrorMsg(null);
    }
  }, [open, initialConfig]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleJsonFile = async (file: File | null) => {
    setErrorMsg(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setErrorMsg("Please select a valid .json Service Account file.");
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        client_email?: string;
        private_key?: string;
        project_id?: string;
      };
      if (!parsed.client_email || !parsed.private_key) {
        setErrorMsg("Invalid Service Account JSON (missing client_email or private_key).");
        return;
      }
      setDraft((prev) => ({
        ...prev,
        vertexSaJsonB64: encodeUtf8ToBase64(text),
        vertexEmail: parsed.client_email || "",
        vertexProjectId: parsed.project_id || prev.vertexProjectId || "fptu2025",
      }));
    } catch {
      setErrorMsg("Failed to parse JSON file.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="byok-modal-title"
      onClick={onClose}
    >
      <div
        className="brutal-card w-full max-w-lg bg-surface p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-ink pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-ink" />
            <h2 id="byok-modal-title" className="font-display text-base font-bold text-ink">
              Bring Your Own API Keys (Session Only)
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close API Keys dialog"
            onClick={onClose}
            className="border border-ink bg-mutedSurface p-1 hover:bg-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-xs text-inkSecondary">
          Keys are stored in browser <code className="font-mono font-semibold">sessionStorage</code>{" "}
          only and sent via HTTP headers per request (never saved on Render).
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="byok-gemini-key"
              className="mb-1.5 block font-display text-xs font-bold uppercase text-ink"
            >
              1. Gemini API Key (AI Studio · Required for Decisions API)
            </label>
            <div className="flex border-2 border-ink bg-white">
              <input
                id="byok-gemini-key"
                type={showKey ? "text" : "password"}
                value={draft.geminiApiKey}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, geminiApiKey: e.target.value }))
                }
                placeholder="Paste your GEMINI_API_KEY..."
                className="w-full px-3 py-2 font-mono text-xs text-ink focus:outline-none"
              />
              <button
                type="button"
                aria-label={showKey ? "Hide API key" : "Show API key"}
                onClick={() => setShowKey((s) => !s)}
                className="border-l-2 border-ink bg-mutedSurface px-2.5 text-ink hover:bg-white"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block font-display text-xs font-bold uppercase text-ink">
              2. Vertex AI Service Account (.json · Optional for gemini-3.8-flash)
            </span>
            <p className="mb-2 text-[11px] text-inkSecondary">
              If omitted, the LLM track automatically uses your Gemini API Key via{" "}
              <code className="font-mono">gemini-3.6-flash</code>.
            </p>

            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => handleJsonFile(e.target.files?.[0] ?? null)}
            />

            {draft.vertexSaJsonB64 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-2 border-gdgGreen bg-emerald-50 px-3 py-2 font-mono text-xs">
                <div className="flex min-w-0 items-center gap-2 text-gdgGreen">
                  <FileKey2 className="h-4 w-4 shrink-0" />
                  <span className="truncate font-semibold">
                    {draft.vertexEmail || "Service Account loaded"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDraft((prev) => ({
                      ...prev,
                      vertexSaJsonB64: "",
                      vertexEmail: "",
                    }));
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="border border-ink bg-white px-2 py-0.5 text-[11px] font-bold text-ink hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 border-2 border-dashed border-ink bg-mutedSurface px-3 py-3 font-mono text-xs font-semibold text-ink hover:bg-white"
              >
                <Upload className="h-4 w-4" />
                Select GCP Service Account .json file
              </button>
            )}

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="byok-project"
                  className="mb-1 block font-mono text-[10px] font-semibold uppercase text-inkSecondary"
                >
                  Vertex Project
                </label>
                <input
                  id="byok-project"
                  type="text"
                  value={draft.vertexProjectId}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, vertexProjectId: e.target.value }))
                  }
                  className="w-full border-2 border-ink bg-white px-2.5 py-1.5 font-mono text-xs text-ink"
                />
              </div>
              <div>
                <label
                  htmlFor="byok-location"
                  className="mb-1 block font-mono text-[10px] font-semibold uppercase text-inkSecondary"
                >
                  Vertex Location
                </label>
                <input
                  id="byok-location"
                  type="text"
                  value={draft.vertexLocation}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, vertexLocation: e.target.value }))
                  }
                  className="w-full border-2 border-ink bg-white px-2.5 py-1.5 font-mono text-xs text-ink"
                />
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="border-2 border-gdgRed bg-red-50 px-3 py-2 font-mono text-xs text-gdgRed">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink pt-3">
          <button
            type="button"
            onClick={() => {
              setDraft({ ...EMPTY_BYOK });
              onClear();
              onClose();
            }}
            className="brutal-btn flex items-center gap-1.5 border-2 border-ink bg-mutedSurface px-3 py-1.5 font-display text-xs font-bold text-ink hover:bg-white"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Keys
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="brutal-btn border-2 border-ink bg-white px-3.5 py-1.5 font-display text-xs font-bold text-ink hover:bg-mutedSurface"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(draft);
                onClose();
              }}
              className="brutal-btn border-2 border-ink bg-fptu px-4 py-1.5 font-display text-xs font-bold text-ink shadow-brutalSm hover:brightness-105"
            >
              Save &amp; Ping
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
