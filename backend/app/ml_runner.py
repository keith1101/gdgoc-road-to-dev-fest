import pickle
import time
from typing import Any

from .config import SVM_MODEL_LABEL, SVM_MODEL_PATH
from .schemas import TrackResult

_SVM_BUNDLE: dict[str, Any] | None = None


def load_svm_bundle() -> dict[str, Any]:
    global _SVM_BUNDLE
    if _SVM_BUNDLE is None:
        with open(SVM_MODEL_PATH, "rb") as f:
            _SVM_BUNDLE = pickle.load(f)
    return _SVM_BUNDLE


def predict_svm(text: str) -> TrackResult:
    bundle = load_svm_bundle()
    payload = text if text is not None else ""

    t0 = time.perf_counter()
    action_model = bundle["action_model"]
    tool_model = bundle["tool_model"]
    ap = action_model.predict_proba([payload])[0]
    tp = tool_model.predict_proba([payload])[0]
    rtt_ms = round((time.perf_counter() - t0) * 1000.0, 3)

    route_target = str(action_model.classes_[int(ap.argmax())])
    target_mcp_tool = str(tool_model.classes_[int(tp.argmax())])
    confidence = round(float(ap.max()), 4)

    return TrackResult(
        track="ml",
        model_name=SVM_MODEL_LABEL,
        status="ok",
        route_target=route_target,
        target_mcp_tool=target_mcp_tool,
        is_prompt_injection=(route_target == "BLOCK_POLICY"),
        is_in_scope=None,
        risk_severity=None,
        requires_human_review=(
            route_target in ("HUMAN_APPROVAL", "ESCALATE_REASONING")
        ),
        confidence=confidence,
        rtt_ms=rtt_ms,
        input_tokens=0,
        output_tokens=0,
        thought_tokens=0,
        est_cost_per_1m_usd=0.0,
    )
