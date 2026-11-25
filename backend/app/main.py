import asyncio
import json
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .config import (
    ALLOWED_MIME_TYPES,
    DATA_DIR,
    DECISION_CONCURRENCY,
    DECISION_MODEL,
    FRONTEND_DIST_DIR,
    LLM_PACER_INTERVAL_S,
    MAX_FILE_BYTES,
    REAL_DOCS_DIR,
    SSE_HEARTBEAT_S,
)
from .dataset_loader import (
    build_input_blocks,
    build_sample_input_blocks,
    get_samples,
    load_all_samples,
    resolve_sample_file,
)
from .gemini_runner import AsyncRatePacer, ping_decision_api, run_decision_1, run_flash_lite
from .metrics import summarize_track
from .ml_runner import load_svm_bundle, predict_svm
from .schemas import SampleMeta, SingleInspectResponse, TrackName


@asynccontextmanager
async def lifespan(_app: FastAPI):
    load_svm_bundle()
    load_all_samples()
    yield


app = FastAPI(
    title="GDGoC DevFest 2026 — Control Plane Benchmark API",
    version="4.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

if REAL_DOCS_DIR.exists():
    app.mount(
        "/api/assets/real_docs",
        StaticFiles(directory=str(REAL_DOCS_DIR)),
        name="real_docs",
    )


@app.get("/api/healthz")
async def healthz() -> dict[str, Any]:
    bundle = load_svm_bundle()
    samples = load_all_samples()
    return {
        "status": "ok",
        "svm_loaded": bundle is not None,
        "samples_count": len(samples),
        "data_dir": str(DATA_DIR),
    }


@app.get("/api/ping")
async def ping(request: Request) -> dict[str, Any]:
    api_key = request.headers.get("x-gemini-api-key")
    return await ping_decision_api(api_key=api_key)


@app.get("/api/samples")
async def list_samples(limit: int = Query(default=10, ge=1, le=20)) -> dict[str, Any]:
    items = get_samples(limit)
    metas = [
        SampleMeta(
            id=s["id"],
            source=s["source"],
            modality=s["modality"],
            ground_truth=s["ground_truth"],
            expected_tool=s["expected_tool"],
            is_prompt_injection=bool(s["is_prompt_injection"]),
            expected_risk=int(s["expected_risk"]),
            difficulty=s["difficulty"],
            file_path=s.get("file_path"),
        ).model_dump()
        for s in items
    ]
    return {"count": len(metas), "samples": metas}


@app.post("/api/decide/single", response_model=SingleInspectResponse)
async def decide_single(
    request: Request,
    text: str = Form(default=""),
    file: UploadFile | None = File(default=None),
) -> SingleInspectResponse:
    api_key = request.headers.get("x-gemini-api-key")
    vertex_sa_b64 = request.headers.get("x-vertex-sa-json")
    vertex_project = request.headers.get("x-vertex-project")
    vertex_location = request.headers.get("x-vertex-location")
    file_bytes: bytes | None = None
    mime_type: str | None = None

    if file is not None and file.filename:
        mime_type = (file.content_type or "").lower()
        if mime_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file MIME type: {mime_type}. Allowed: PNG, JPG, WEBP, PDF.",
            )
        file_bytes = await file.read()
        if len(file_bytes) > MAX_FILE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"File exceeds 5 MB limit ({len(file_bytes)} bytes).",
            )

    if not text.strip() and not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="Provide request text or attach a file (PNG/JPG/WEBP/PDF).",
        )

    input_blocks = build_input_blocks(text, file_bytes, mime_type)

    async def _run_ml():
        return await asyncio.to_thread(predict_svm, text, file_bytes, mime_type)

    ml_res, dec_res, llm_res = await asyncio.gather(
        _run_ml(),
        run_decision_1(input_blocks, api_key=api_key),
        run_flash_lite(
            input_blocks,
            api_key=api_key,
            vertex_sa_b64=vertex_sa_b64,
            vertex_project=vertex_project,
            vertex_location=vertex_location,
        ),
    )

    return SingleInspectResponse(ml=ml_res, decision=dec_res, llm=llm_res)


def _sse_event(event: str, payload: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


@app.api_route("/api/benchmark/stream", methods=["GET", "POST"])
async def benchmark_stream(
    request: Request,
    limit: int = Query(default=10),
) -> StreamingResponse:
    if limit not in (5, 10, 20):
        raise HTTPException(status_code=400, detail="limit must be 5, 10, or 20")

    api_key = request.headers.get("x-gemini-api-key")
    vertex_sa_b64 = request.headers.get("x-vertex-sa-json")
    vertex_project = request.headers.get("x-vertex-project")
    vertex_location = request.headers.get("x-vertex-location")

    samples = get_samples(limit)
    total = len(samples)

    async def event_generator():
        queue: asyncio.Queue[tuple[str, dict[str, Any]]] = asyncio.Queue()
        records_by_track: dict[TrackName, list[dict[str, Any]]] = {
            "ml": [],
            "decision": [],
            "llm": [],
        }
        track_wall_ms: dict[TrackName, float] = {"ml": 0.0, "decision": 0.0, "llm": 0.0}
        dec_sem = asyncio.Semaphore(DECISION_CONCURRENCY)
        llm_pacer = AsyncRatePacer(LLM_PACER_INTERVAL_S)

        init_samples = [
            {
                "id": s["id"],
                "source": s["source"],
                "modality": s["modality"],
                "ground_truth": s["ground_truth"],
                "expected_tool": s["expected_tool"],
                "difficulty": s["difficulty"],
            }
            for s in samples
        ]
        yield _sse_event("init", {"total": total, "samples": init_samples})

        async def run_ml_track() -> None:
            t0 = time.perf_counter()
            for idx, s in enumerate(samples):
                raw_text = s.get("text", "")
                fpath = resolve_sample_file(s.get("file_path"))
                fb = fpath.read_bytes() if (fpath and fpath.exists()) else None
                mt = s.get("mime_type") or ("image/jpeg" if fb else None)
                res = await asyncio.to_thread(predict_svm, raw_text, fb, mt)
                rec = {
                    "track": "ml",
                    "index": idx,
                    "sample_id": s["id"],
                    "action_correct": res.route_target == s["ground_truth"],
                    "tool_correct": res.target_mcp_tool == s["expected_tool"],
                    "result": res.model_dump(),
                }
                records_by_track["ml"].append(rec)
                await queue.put(("result", rec))
            track_wall_ms["ml"] = (time.perf_counter() - t0) * 1000.0
            summary = summarize_track("ml", records_by_track["ml"], total, track_wall_ms["ml"])
            await queue.put(("track_done", summary.model_dump()))

        async def run_decision_track() -> None:
            t0 = time.perf_counter()

            async def one(idx: int, s: dict[str, Any]) -> None:
                blocks = build_sample_input_blocks(s)
                async with dec_sem:
                    res = await run_decision_1(blocks, api_key=api_key)
                rec = {
                    "track": "decision",
                    "index": idx,
                    "sample_id": s["id"],
                    "action_correct": res.status == "ok" and res.route_target == s["ground_truth"],
                    "tool_correct": res.status == "ok" and res.target_mcp_tool == s["expected_tool"],
                    "result": res.model_dump(),
                }
                records_by_track["decision"].append(rec)
                await queue.put(("result", rec))

            await asyncio.gather(*(one(i, s) for i, s in enumerate(samples)))
            track_wall_ms["decision"] = (time.perf_counter() - t0) * 1000.0
            summary = summarize_track(
                "decision", records_by_track["decision"], total, track_wall_ms["decision"]
            )
            await queue.put(("track_done", summary.model_dump()))

        async def run_llm_track() -> None:
            t0 = time.perf_counter()
            for idx, s in enumerate(samples):
                blocks = build_sample_input_blocks(s)
                res = await run_flash_lite(
                    blocks,
                    pacer=llm_pacer,
                    api_key=api_key,
                    vertex_sa_b64=vertex_sa_b64,
                    vertex_project=vertex_project,
                    vertex_location=vertex_location,
                )
                rec = {
                    "track": "llm",
                    "index": idx,
                    "sample_id": s["id"],
                    "action_correct": res.status == "ok" and res.route_target == s["ground_truth"],
                    "tool_correct": res.status == "ok" and res.target_mcp_tool == s["expected_tool"],
                    "result": res.model_dump(),
                }
                records_by_track["llm"].append(rec)
                await queue.put(("result", rec))
            track_wall_ms["llm"] = (time.perf_counter() - t0) * 1000.0
            summary = summarize_track("llm", records_by_track["llm"], total, track_wall_ms["llm"])
            await queue.put(("track_done", summary.model_dump()))

        tasks = [
            asyncio.create_task(run_ml_track()),
            asyncio.create_task(run_decision_track()),
            asyncio.create_task(run_llm_track()),
        ]
        tracks_done = 0

        try:
            while tracks_done < 3:
                if await request.is_disconnected():
                    break
                try:
                    ev, data = await asyncio.wait_for(queue.get(), timeout=SSE_HEARTBEAT_S)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue

                yield _sse_event(ev, data)
                if ev == "track_done":
                    tracks_done += 1

            if tracks_done == 3:
                all_summaries = {
                    t: summarize_track(t, records_by_track[t], total, track_wall_ms[t]).model_dump()
                    for t in ("ml", "decision", "llm")
                }
                yield _sse_event("complete", {"summaries": all_summaries})
        finally:
            for task in tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if FRONTEND_DIST_DIR.exists():
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend_assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)
        candidate = (FRONTEND_DIST_DIR / full_path).resolve()
        if full_path and str(candidate).startswith(str(FRONTEND_DIST_DIR.resolve())) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST_DIR / "index.html")
