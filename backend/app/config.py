import os
from pathlib import Path

_THIS_FILE = Path(__file__).resolve()


def _resolve_data_dir() -> Path:
    container_data = Path("/app/data")
    if container_data.exists():
        return container_data
    local_data = _THIS_FILE.parents[2] / "data"
    if local_data.exists():
        return local_data
    return _THIS_FILE.parents[3] / "data"


def _resolve_frontend_dist() -> Path:
    container_dist = Path("/app/frontend_dist")
    if container_dist.exists():
        return container_dist
    return _THIS_FILE.parents[2] / "frontend" / "dist"


DATA_DIR: Path = _resolve_data_dir()
SAMPLES_PATH: Path = DATA_DIR / "samples.json"
SVM_MODEL_PATH: Path = DATA_DIR / "svm_baseline.pkl"
REAL_DOCS_DIR: Path = DATA_DIR / "assets" / "real_docs"
FRONTEND_DIST_DIR: Path = _resolve_frontend_dist()

MAX_FILE_BYTES: int = 5 * 1024 * 1024
ALLOWED_MIME_TYPES: set[str] = {
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/pdf",
}

DECISION_MODEL: str = "gemini-decision-1"
LLM_MODEL: str = "gemini-3.8-flash"
VERTEX_PROJECT_ID: str = os.environ.get("VERTEX_PROJECT_ID", "fptu2025")
VERTEX_LOCATION: str = os.environ.get("VERTEX_LOCATION", "global")
SVM_MODEL_LABEL: str = "Dual-Head Calibrated SVM"

DECISION_CONCURRENCY: int = 3
LLM_PACER_INTERVAL_S: float = 0.5
LLM_RETRY_DELAYS: tuple[float, ...] = (4.0, 8.0, 15.0)
SSE_HEARTBEAT_S: float = 10.0

PRICING: dict[str, dict[str, float]] = {
    "ml": {"input_per_1m": 0.0, "output_per_1m": 0.0},
    "decision": {"input_per_1m": 0.10, "output_per_1m": 0.0},
    "llm": {"input_per_1m": 0.75, "output_per_1m": 3.75},
}

ACTION_LABELS: tuple[str, ...] = (
    "READ_ONLY_QUERY",
    "BLOCK_POLICY",
    "FAST_TOOL_EXEC",
    "HUMAN_APPROVAL",
    "ESCALATE_REASONING",
)

TOOL_LABELS: tuple[str, ...] = (
    "mcp_docs_read",
    "none_blocked",
    "mcp_account_diag",
    "mcp_network_diag",
    "mcp_billing_approve",
    "mcp_security_triage",
)
