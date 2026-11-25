export interface ByokConfig {
  geminiApiKey: string;
  vertexSaJsonB64: string;
  vertexEmail: string;
  vertexProjectId: string;
  vertexLocation: string;
}

const SESSION_KEY = "gdgoc_devfest_byok_v1";

export const EMPTY_BYOK: ByokConfig = {
  geminiApiKey: "",
  vertexSaJsonB64: "",
  vertexEmail: "",
  vertexProjectId: "fptu2025",
  vertexLocation: "global",
};

export function loadByokConfig(): ByokConfig {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { ...EMPTY_BYOK };
    const parsed = JSON.parse(raw) as Partial<ByokConfig>;
    return {
      geminiApiKey: parsed.geminiApiKey ?? "",
      vertexSaJsonB64: parsed.vertexSaJsonB64 ?? "",
      vertexEmail: parsed.vertexEmail ?? "",
      vertexProjectId: parsed.vertexProjectId || "fptu2025",
      vertexLocation: parsed.vertexLocation || "global",
    };
  } catch {
    return { ...EMPTY_BYOK };
  }
}

export function saveByokConfig(cfg: ByokConfig): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearByokConfig(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore
  }
}

export function encodeUtf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

export function getAuthHeaders(): Record<string, string> {
  const cfg = loadByokConfig();
  const headers: Record<string, string> = {};
  if (cfg.geminiApiKey.trim()) {
    headers["X-Gemini-Api-Key"] = cfg.geminiApiKey.trim();
  }
  if (cfg.vertexSaJsonB64.trim()) {
    headers["X-Vertex-Sa-Json"] = cfg.vertexSaJsonB64.trim();
    if (cfg.vertexProjectId.trim()) {
      headers["X-Vertex-Project"] = cfg.vertexProjectId.trim();
    }
    if (cfg.vertexLocation.trim()) {
      headers["X-Vertex-Location"] = cfg.vertexLocation.trim();
    }
  }
  return headers;
}
