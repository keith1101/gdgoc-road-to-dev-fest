import math
from typing import Any

from .config import PRICING
from .schemas import TrackName, TrackSummary


def _percentile(sorted_vals: list[float], pct: float) -> float:
    if not sorted_vals:
        return 0.0
    if len(sorted_vals) == 1:
        return round(sorted_vals[0], 2)
    idx = min(int(math.ceil(pct * len(sorted_vals))) - 1, len(sorted_vals) - 1)
    idx = max(0, idx)
    return round(sorted_vals[idx], 2)


def _compute_ece_brier(
    probs: list[float], corrects: list[int], num_bins: int = 5
) -> tuple[float | None, float | None]:
    n = len(probs)
    if n == 0:
        return None, None
    brier = sum((p - y) ** 2 for p, y in zip(probs, corrects)) / n
    ece = 0.0
    for b in range(num_bins):
        lo = b / num_bins
        hi = (b + 1) / num_bins
        in_bin = [
            (p, y)
            for p, y in zip(probs, corrects)
            if (lo <= p < hi) or (b == num_bins - 1 and p == 1.0)
        ]
        if not in_bin:
            continue
        avg_conf = sum(p for p, _ in in_bin) / len(in_bin)
        avg_acc = sum(y for _, y in in_bin) / len(in_bin)
        ece += (len(in_bin) / n) * abs(avg_acc - avg_conf)
    return round(ece, 4), round(brier, 4)


def summarize_track(
    track: TrackName,
    records: list[dict[str, Any]],
    total_samples: int,
    total_wall_ms: float,
) -> TrackSummary:
    ok_recs = [r for r in records if r["result"]["status"] == "ok"]
    err_recs = [r for r in records if r["result"]["status"] != "ok"]
    completed = len(ok_recs)

    if completed == 0:
        return TrackSummary(
            track=track,
            completed=0,
            errors=len(err_recs),
            total=total_samples,
            accuracy_all=0.0,
            accuracy_text=None,
            accuracy_complex=None,
            tool_accuracy=0.0,
            p50_ms=0.0,
            p95_ms=0.0,
            total_wall_ms=round(total_wall_ms, 1),
            total_input_tokens=0,
            total_output_tokens=0,
            total_thought_tokens=0,
            avg_output_tokens=0.0,
            est_cost_per_1m_usd=0.0,
            retries_503=sum(r["result"].get("retries_503", 0) for r in records),
            retries_429=sum(r["result"].get("retries_429", 0) for r in records),
        )

    action_hits = [1 if r["action_correct"] else 0 for r in ok_recs]
    tool_hits = [1 if r["tool_correct"] else 0 for r in ok_recs]
    text_recs = [r for r in ok_recs if r["sample_id"].startswith("tobi_")]
    complex_recs = [r for r in ok_recs if not r["sample_id"].startswith("tobi_")]

    latencies = sorted(float(r["result"]["rtt_ms"]) for r in ok_recs)
    sum_in = sum(int(r["result"].get("input_tokens", 0)) for r in ok_recs)
    sum_out = sum(int(r["result"].get("output_tokens", 0)) for r in ok_recs)
    sum_thought = sum(int(r["result"].get("thought_tokens", 0)) for r in ok_recs)

    rates = PRICING[track]
    est_cost_1m = (
        (sum_in * rates["input_per_1m"] + (sum_out + sum_thought) * rates["output_per_1m"])
        / completed
    )

    confs = [
        float(r["result"]["confidence"])
        for r in ok_recs
        if r["result"].get("confidence") is not None
    ]
    conf_hits = [
        1 if r["action_correct"] else 0
        for r in ok_recs
        if r["result"].get("confidence") is not None
    ]
    ece, brier = _compute_ece_brier(confs, conf_hits)

    escalated_count = sum(
        1
        for r in ok_recs
        if r["result"].get("confidence") is not None
        and float(r["result"]["confidence"]) < 0.90
    )

    return TrackSummary(
        track=track,
        completed=completed,
        errors=len(err_recs),
        total=total_samples,
        accuracy_all=round(sum(action_hits) / completed * 100.0, 1),
        accuracy_text=(
            round(sum(1 for r in text_recs if r["action_correct"]) / len(text_recs) * 100.0, 1)
            if text_recs
            else None
        ),
        accuracy_complex=(
            round(sum(1 for r in complex_recs if r["action_correct"]) / len(complex_recs) * 100.0, 1)
            if complex_recs
            else None
        ),
        tool_accuracy=round(sum(tool_hits) / completed * 100.0, 1),
        p50_ms=_percentile(latencies, 0.50),
        p95_ms=_percentile(latencies, 0.95),
        total_wall_ms=round(total_wall_ms, 1),
        total_input_tokens=sum_in,
        total_output_tokens=sum_out,
        total_thought_tokens=sum_thought,
        avg_output_tokens=round((sum_out + sum_thought) / completed, 1),
        est_cost_per_1m_usd=round(est_cost_1m, 2),
        retries_503=sum(int(r["result"].get("retries_503", 0)) for r in records),
        retries_429=sum(int(r["result"].get("retries_429", 0)) for r in records),
        ece_5bin=ece,
        brier_score=brier,
        escalated_count=escalated_count,
        escalated_pct=round(escalated_count / completed * 100.0, 1),
    )
