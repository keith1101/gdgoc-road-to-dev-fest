import pickle
import time
from typing import Any

from .config import SVM_MODEL_LABEL, SVM_MODEL_PATH
from .schemas import TrackResult

_SVM_BUNDLE: dict[str, Any] | None = None
_OCR_ENGINE: Any | None = None


def load_svm_bundle() -> dict[str, Any]:
    global _SVM_BUNDLE
    if _SVM_BUNDLE is None:
        with open(SVM_MODEL_PATH, "rb") as f:
            _SVM_BUNDLE = pickle.load(f)
    return _SVM_BUNDLE


def load_ocr_engine() -> Any:
    """Lazy-load CPU RapidOCR engine once for image-to-text preprocessing."""
    global _OCR_ENGINE
    if _OCR_ENGINE is None:
        from rapidocr_onnxruntime import RapidOCR

        _OCR_ENGINE = RapidOCR()
    return _OCR_ENGINE


def _extract_ocr_text(file_bytes: bytes) -> str:
    try:
        ocr = load_ocr_engine()
        res, _ = ocr(file_bytes)
        if not res:
            return ""
        return " ".join(str(line[1]) for line in res if len(line) > 1 and line[1])
    except Exception:
        return ""


def predict_svm(
    text: str,
    file_bytes: bytes | None = None,
    mime_type: str | None = None,
) -> TrackResult:
    bundle = load_svm_bundle()
    payload = text if text is not None else ""
    model_label = SVM_MODEL_LABEL

    t0 = time.perf_counter()
    if file_bytes and (mime_type or "").startswith("image/"):
        ocr_text = _extract_ocr_text(file_bytes)
        if ocr_text:
            payload = f"{payload}\n{ocr_text}".strip()
        model_label = f"{SVM_MODEL_LABEL} + RapidOCR"

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
        model_name=model_label,
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
