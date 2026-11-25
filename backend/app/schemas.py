from typing import Literal
from pydantic import BaseModel, Field

TrackName = Literal["ml", "decision", "llm"]
ActionLabel = Literal[
    "READ_ONLY_QUERY",
    "BLOCK_POLICY",
    "FAST_TOOL_EXEC",
    "HUMAN_APPROVAL",
    "ESCALATE_REASONING",
]
ToolLabel = Literal[
    "mcp_docs_read",
    "none_blocked",
    "mcp_account_diag",
    "mcp_network_diag",
    "mcp_billing_approve",
    "mcp_security_triage",
]


class LLMDecisionJSON(BaseModel):
    is_prompt_injection: bool
    is_in_scope: bool
    route_target: ActionLabel
    target_mcp_tool: ToolLabel
    risk_severity: int = Field(ge=0, le=4)
    requires_human_review: bool
    confidence: float = Field(ge=0.0, le=1.0)


class TrackResult(BaseModel):
    track: TrackName
    model_name: str
    status: Literal["ok", "error"] = "ok"
    error_message: str | None = None
    route_target: str | None = None
    target_mcp_tool: str | None = None
    is_prompt_injection: bool | None = None
    is_in_scope: bool | None = None
    risk_severity: int | None = None
    requires_human_review: bool | None = None
    confidence: float | None = None
    p_injection: float | None = None
    p_in_scope: float | None = None
    rtt_ms: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    thought_tokens: int = 0
    est_cost_per_1m_usd: float = 0.0
    retries_503: int = 0
    retries_429: int = 0


class SingleInspectResponse(BaseModel):
    ml: TrackResult
    decision: TrackResult
    llm: TrackResult


class SampleMeta(BaseModel):
    id: str
    source: str
    modality: str
    ground_truth: str
    expected_tool: str
    is_prompt_injection: bool
    expected_risk: int
    difficulty: str
    file_path: str | None = None


class TrackSummary(BaseModel):
    track: TrackName
    completed: int
    errors: int
    total: int
    accuracy_all: float
    accuracy_text: float | None = None
    accuracy_complex: float | None = None
    tool_accuracy: float
    p50_ms: float
    p95_ms: float
    total_wall_ms: float
    total_input_tokens: int
    total_output_tokens: int
    total_thought_tokens: int
    avg_output_tokens: float
    est_cost_per_1m_usd: float
    retries_503: int
    retries_429: int
    ece_5bin: float | None = None
    brier_score: float | None = None
    escalated_count: int = 0
    escalated_pct: float = 0.0
