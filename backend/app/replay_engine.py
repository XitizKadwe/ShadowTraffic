import asyncio
import json
import math
import os
import time
from datetime import datetime

import httpx
from deepdiff import DeepDiff

from .database import CapturedRequest, ReplayRun, SessionLocal, TrafficDiffResult


DEMO_PORT = int(os.getenv("SHADOWTRAFFIC_DEMO_PORT", "8000"))
MAX_RUN_TIMEOUT_SECONDS = 5


def _json(value):
    return json.dumps(value, ensure_ascii=True, separators=(",", ":"), default=str)


def _percentile_95(values):
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, math.ceil(0.95 * len(ordered)) - 1)
    return round(ordered[index], 2)


def _differences(left, right):
    diff = DeepDiff(left, right, ignore_order=True, view="tree")
    flattened = []
    for category, entries in diff.to_dict().items():
        for node in entries:
            item = {
                "kind": category,
                "path": node.path().replace("root", "$", 1),
            }
            if category.endswith("_removed"):
                item["old_value"] = node.t1
                item["new_value"] = "[missing]"
            elif category.endswith("_added"):
                item["old_value"] = "[missing]"
                item["new_value"] = node.t2
            else:
                item["old_value"] = node.t1
                item["new_value"] = node.t2
            flattened.append(item)
    return json.loads(_json(flattened))


async def _send(client, version, captured):
    url = f"http://127.0.0.1:{DEMO_PORT}/demo/v{version}{captured['path']}"
    kwargs = {
        "params": captured["query"],
        "headers": captured["headers"],
        "timeout": MAX_RUN_TIMEOUT_SECONDS,
        "follow_redirects": False,
    }
    if captured["body"] is not None:
        kwargs["json"] = captured["body"]

    started = time.perf_counter()
    try:
        response = await client.request(captured["method"], url, **kwargs)
        try:
            body = response.json()
        except ValueError:
            body = response.text[:20_000]
        value = {"status_code": response.status_code, "body": body}
    except httpx.TimeoutException:
        value = {"status_code": 0, "error": "Demo target timed out"}
    except httpx.RequestError as exc:
        value = {"status_code": 0, "error": f"Demo target connection failed: {exc}"}
    elapsed_ms = (time.perf_counter() - started) * 1000
    return value, elapsed_ms


async def _execute(run_id, concurrency):
    with SessionLocal() as db:
        run = db.get(ReplayRun, run_id)
        if run is None:
            return
        run.status = "running"
        run.started_at = datetime.utcnow()
        request_limit = run.request_limit
        db.commit()
        captured_rows = (
            db.query(CapturedRequest)
            .order_by(CapturedRequest.recorded_at.desc(), CapturedRequest.id.desc())
            .limit(request_limit)
            .all()
        )
        captured = [
            {
                "id": row.id,
                "method": row.method,
                "path": row.path,
                "query": json.loads(row.query_json),
                "headers": json.loads(row.headers_json),
                "body": json.loads(row.body_json) if row.body_json is not None else None,
            }
            for row in captured_rows
        ]

    semaphore = asyncio.Semaphore(concurrency)
    timeout = httpx.Timeout(MAX_RUN_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
        async def replay_one(item):
            async with semaphore:
                baseline, candidate = await asyncio.gather(
                    _send(client, 1, item),
                    _send(client, 2, item),
                )
                differences = _differences(baseline[0], candidate[0])
                is_error = baseline[0].get("status_code") == 0 or candidate[0].get("status_code") == 0
                return {
                    "captured_request_id": item["id"],
                    "baseline": baseline[0],
                    "candidate": candidate[0],
                    "baseline_latency_ms": round(baseline[1], 2),
                    "candidate_latency_ms": round(candidate[1], 2),
                    "differences": differences,
                    "has_diff": bool(differences),
                    "request_error": is_error,
                }

        results = await asyncio.gather(*(replay_one(item) for item in captured))

    with SessionLocal() as db:
        run = db.get(ReplayRun, run_id)
        if run is None:
            return
        for result in results:
            db.add(
                TrafficDiffResult(
                    run_id=run.id,
                    captured_request_id=result["captured_request_id"],
                    has_diff=result["has_diff"],
                    differences_json=_json(result["differences"]),
                    baseline_response_json=_json(result["baseline"]),
                    candidate_response_json=_json(result["candidate"]),
                    baseline_latency_ms=result["baseline_latency_ms"],
                    candidate_latency_ms=result["candidate_latency_ms"],
                    request_error=result["request_error"],
                )
            )
        run.processed_count = len(results)
        run.diff_count = sum(result["has_diff"] for result in results)
        run.error_count = sum(result["request_error"] for result in results)
        run.diff_rate = round((run.diff_count / len(results) * 100), 4) if results else 0
        run.baseline_p95_ms = _percentile_95([result["baseline_latency_ms"] for result in results])
        run.candidate_p95_ms = _percentile_95([result["candidate_latency_ms"] for result in results])
        run.status = "completed"
        run.completed_at = datetime.utcnow()
        db.commit()


def execute_replay(run_id, concurrency):
    try:
        asyncio.run(_execute(run_id, concurrency))
    except Exception as exc:
        with SessionLocal() as db:
            run = db.get(ReplayRun, run_id)
            if run is not None:
                run.status = "failed"
                run.error = f"Replay processing failed: {exc}"
                run.completed_at = datetime.utcnow()
                db.commit()
