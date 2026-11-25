export type TrackName = "ml" | "decision" | "llm";

export interface TrackResult {
  track: TrackName;
  model_name: string;
  status: "ok" | "error";
  error_message?: string | null;
  route_target?: string | null;
  target_mcp_tool?: string | null;
  is_prompt_injection?: boolean | null;
  is_in_scope?: boolean | null;
  risk_severity?: number | null;
  requires_human_review?: boolean | null;
  confidence?: number | null;
  p_injection?: number | null;
  p_in_scope?: number | null;
  rtt_ms: number;
  input_tokens: number;
  output_tokens: number;
  thought_tokens: number;
  est_cost_per_1m_usd: number;
  retries_503: number;
  retries_429: number;
}

export interface CascadeResult {
  threshold: number;
  escalated: boolean;
  trigger_reason: string;
  final_source: "decision" | "system2" | string;
  final_route_target?: string | null;
  final_target_mcp_tool?: string | null;
  est_blended_cost_per_1m_usd: number;
  system2?: TrackResult | null;
}

export interface SingleInspectResponse {
  ml: TrackResult;
  decision: TrackResult;
  llm: TrackResult;
  cascade?: CascadeResult | null;
}

export interface SampleInitMeta {
  id: string;
  source: string;
  modality: string;
  ground_truth: string;
  expected_tool: string;
  difficulty: string;
}

export interface StreamSampleEvent {
  track: TrackName;
  index: number;
  sample_id: string;
  action_correct: boolean;
  tool_correct: boolean;
  result: TrackResult;
}

export interface TrackSummary {
  track: TrackName;
  completed: number;
  errors: number;
  total: number;
  accuracy_all: number;
  accuracy_text: number | null;
  accuracy_complex: number | null;
  tool_accuracy: number;
  p50_ms: number;
  p95_ms: number;
  total_wall_ms: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_thought_tokens: number;
  avg_output_tokens: number;
  est_cost_per_1m_usd: number;
  retries_503: number;
  retries_429: number;
  ece_5bin: number | null;
  brier_score: number | null;
  escalated_count: number;
  escalated_pct: number;
}

export interface WaterfallRow {
  meta: SampleInitMeta;
  ml?: StreamSampleEvent;
  decision?: StreamSampleEvent;
  llm?: StreamSampleEvent;
}

export interface ArenaSnapshot {
  limit: 5 | 10 | 20 | 100;
  updatedAt: string;
  rows: WaterfallRow[];
  summaries: Partial<Record<TrackName, TrackSummary>>;
}
