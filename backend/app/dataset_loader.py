import base64
import json
from pathlib import Path
from typing import Any

from .config import BENCHMARK_100_PATH, DATA_DIR, SAMPLES_PATH

_SAMPLES_CACHE: list[dict[str, Any]] | None = None
_BENCHMARK_100_CACHE: list[dict[str, Any]] | None = None

DEFAULT_ATTACHMENT_PROMPT = (
    "Evaluate and route this attached document for Agentic Control Plane processing."
)


def load_all_samples() -> list[dict[str, Any]]:
    global _SAMPLES_CACHE
    if _SAMPLES_CACHE is None:
        _SAMPLES_CACHE = json.loads(SAMPLES_PATH.read_text(encoding="utf-8"))
    return _SAMPLES_CACHE


def load_benchmark_100() -> list[dict[str, Any]]:
    global _BENCHMARK_100_CACHE
    if _BENCHMARK_100_CACHE is None:
        _BENCHMARK_100_CACHE = json.loads(BENCHMARK_100_PATH.read_text(encoding="utf-8"))
    return _BENCHMARK_100_CACHE


def get_samples(limit: int = 10) -> list[dict[str, Any]]:
    if limit == 100:
        return load_benchmark_100()
    samples = load_all_samples()
    if limit not in (5, 10, 20):
        limit = max(1, min(limit, len(samples)))
    return samples[:limit]


def resolve_sample_file(rel_path: str | None) -> Path | None:
    if not rel_path:
        return None
    resolved = (DATA_DIR / rel_path).resolve()
    data_root = DATA_DIR.resolve()
    if not str(resolved).startswith(str(data_root)):
        raise ValueError(f"Unsafe file path outside DATA_DIR: {rel_path}")
    return resolved


def build_input_blocks(
    text: str,
    file_bytes: bytes | None = None,
    mime_type: str | None = None,
) -> list[dict[str, Any]]:
    clean_text = text.strip()
    if not clean_text and file_bytes:
        clean_text = DEFAULT_ATTACHMENT_PROMPT

    blocks: list[dict[str, Any]] = []
    if clean_text:
        blocks.append({"type": "text", "text": clean_text})

    if file_bytes and mime_type:
        b64 = base64.b64encode(file_bytes).decode("ascii")
        if mime_type == "application/pdf":
            blocks.append({"type": "document", "data": b64, "mime_type": mime_type})
        else:
            blocks.append(
                {
                    "type": "image",
                    "data": b64,
                    "mime_type": mime_type,
                    "resolution": "medium",
                }
            )
    return blocks


def build_sample_input_blocks(sample: dict[str, Any]) -> list[dict[str, Any]]:
    file_bytes: bytes | None = None
    mime_type: str | None = None
    file_path = resolve_sample_file(sample.get("file_path"))
    if file_path is not None and file_path.exists():
        file_bytes = file_path.read_bytes()
        ext = file_path.suffix.lower()
        if ext == ".png":
            mime_type = "image/png"
        elif ext == ".webp":
            mime_type = "image/webp"
        elif ext == ".pdf":
            mime_type = "application/pdf"
        else:
            mime_type = "image/jpeg"
    return build_input_blocks(sample.get("text", ""), file_bytes, mime_type)
