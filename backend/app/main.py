import json
import math
import os
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, Response
from sqlalchemy.orm import Session

from .database import (
    Base,
    CapturedRequest,
    DATABASE_PATH,
    RegressionCase,
    ReplayRun,
    SessionLocal,
    TrafficDiffResult,
    engine,
)
from .demo_services import router as demo_router
from .privacy import sanitize_capture
from .replay_engine import execute_replay
from .schemas import CreateReplayRequest, GenerateRegressionRequest, RecordTrafficRequest


app = FastAPI(
    title="ShadowTraffic",
    description=(
        "Local shadow-traffic capture and replay demo. Replay destinations are fixed "
        "to loopback demo services; requests are redacted before storage."
    ),
    version="1.0.0",
    docs_url=None,
    openapi_tags=[
        {"name": "Workspace", "description": "Health and dashboard summary."},
        {"name": "Captured traffic", "description": "Record and inspect sanitized request samples."},
        {"name": "Replay runs", "description": "Compare captured traffic against local v1 and v2 services."},
        {"name": "Regression cases", "description": "Save and export response differences as regression tests."},
        {"name": "Demo services v1", "description": "Loopback-only baseline service used by shadow replays."},
        {"name": "Demo services v2", "description": "Loopback-only candidate service used by shadow replays."},
    ],
)
app.include_router(demo_router)


@app.get("/docs", include_in_schema=False)
def custom_docs():
    response = get_swagger_ui_html(
        openapi_url=app.openapi_url or "/openapi.json",
        title=f"{app.title} | API reference",
        swagger_ui_parameters={
            "deepLinking": True,
            "displayRequestDuration": True,
            "docExpansion": "none",
            "filter": True,
            "tryItOutEnabled": True,
            "persistAuthorization": False,
            "defaultModelsExpandDepth": 1,
        },
    )
    html = response.body.decode("utf-8")
    html = html.replace(
        '<link rel="shortcut icon"',
        '<link rel="stylesheet" href="/docs-theme.css">\n<link rel="shortcut icon"',
    )
    html = html.replace(
        "<body>",
        """<body>
<header class="docs-topbar">
  <a class="docs-brand" href="/" aria-label="ShadowTraffic control center">
    <span class="docs-mark">ST</span>
    <span><strong>shadowtraffic</strong><small>API REFERENCE</small></span>
  </a>
  <div class="docs-topbar-actions">
    <span class="docs-local-badge"><span></span> LOCAL DEMO</span>
    <a href="/">Control center</a>
    <a class="docs-openapi-link" href="/openapi.json">OpenAPI JSON</a>
  </div>
</header>
<main class="docs-content">
  <section class="docs-hero">
    <div class="docs-eyebrow"><span></span> DEVELOPER DOCUMENTATION</div>
    <h1>Explore the API.<br><em>Replay with confidence.</em></h1>
    <p>Inspect request shapes, try endpoints, and compare the local v1 and v2 demo services. Replay traffic stays on this machine.</p>
    <div class="docs-hero-meta"><span>Interactive reference</span><span>OpenAPI 3.1</span><span>Loopback targets only</span></div>
  </section>""",
    )
    html = html.replace("</body>", "</main>\n</body>")
    return HTMLResponse(content=html, status_code=response.status_code)


@app.get("/docs-theme.css", include_in_schema=False)
def docs_theme():
    return FileResponse(Path(__file__).with_name("docs-theme.css"), media_type="text/css")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _json(value):
    return json.dumps(value, ensure_ascii=True, separators=(",", ":"), default=str)


def _loads(value, default=None):
    if value is None:
        return default
    return json.loads(value)


def _time_ago(value):
    seconds = max(0, int((datetime.utcnow() - value).total_seconds()))
    if seconds < 60:
        return f"{seconds}s ago"
    if seconds < 3600:
        return f"{seconds // 60}m ago"
    if seconds < 86400:
        return f"{seconds // 3600}h ago"
    return f"{seconds // 86400}d ago"


def _run_summary(run):
    return {
        "id": run.id,
        "name": run.name,
        "source": "local-demo-v1",
        "target": "local-demo-v2",
        "status": run.status.title(),
        "requests": run.processed_count,
        "requested": run.request_limit,
        "diffs": run.diff_count,
        "rate": f"{run.diff_rate:.2f}%",
        "diff_rate": run.diff_rate,
        "p95": f"{run.candidate_p95_ms:.0f} ms" if run.candidate_p95_ms is not None else "—",
        "baseline_p95_ms": run.baseline_p95_ms,
        "candidate_p95_ms": run.candidate_p95_ms,
        "time": _time_ago(run.created_at),
        "created_at": run.created_at.isoformat(),
        "duration": (
            f"{max(0, int((run.completed_at - run.started_at).total_seconds()))}s"
            if run.completed_at and run.started_at
            else "—"
        ),
        "error_count": run.error_count,
        "error": run.error,
    }


def _result_detail(result, request):
    differences = _loads(result.differences_json, [])
    baseline = _loads(result.baseline_response_json, {})
    candidate = _loads(result.candidate_response_json, {})
    first = differences[0] if differences else {}
    return {
        "id": result.id,
        "captured_request_id": request.id,
        "service": request.service,
        "method": request.method,
        "path": request.path,
        "query": _loads(request.query_json, {}),
        "headers": _loads(request.headers_json, {}),
        "body": _loads(request.body_json),
        "requestId": _loads(request.headers_json, {}).get("x-request-id", f"capture_{request.id}"),
        "diffType": first.get("kind", "No differences").replace("_", " ").title(),
        "has_diff": result.has_diff,
        "differences": differences,
        "baseline": baseline,
        "candidate": candidate,
        "baseline_latency_ms": result.baseline_latency_ms,
        "candidate_latency_ms": result.candidate_latency_ms,
        "request_error": result.request_error,
    }


def _seed_requests(db):
    if db.query(CapturedRequest).count():
        return
    samples = [
        {
            "service": "checkout-service",
            "method": "POST",
            "path": "/api/v1/checkout",
            "query": {},
            "body": {
                "amount": 128.5,
                "currency": "USD",
                "coupon_code": None,
                "customer_type": "GOV_PSU",
                "tax": 10.28,
            },
        },
        {
            "service": "user-profile",
            "method": "GET",
            "path": "/api/v1/users/4831",
            "query": {},
            "body": None,
        },
        {
            "service": "inventory-api",
            "method": "GET",
            "path": "/api/v1/inventory/sku-204",
            "query": {},
            "body": None,
        },
        {
            "service": "payments",
            "method": "POST",
            "path": "/api/v1/payments/authorize",
            "query": {},
            "body": {"amount": 84.25, "customer_type": "GOV_PSU", "card_number": "4111111111111111"},
        },
        {
            "service": "search",
            "method": "GET",
            "path": "/api/v1/search",
            "query": {"q": "wireless"},
            "body": None,
        },
    ]
    for sample in samples:
        _, path, query, headers, body = sanitize_capture(
            sample["method"], sample["path"], sample["query"], {}, sample["body"]
        )
        db.add(
            CapturedRequest(
                service=sample["service"],
                method=sample["method"],
                path=path,
                query_json=_json(query),
                headers_json=_json(headers),
                body_json=_json(body) if body is not None else None,
                source="built-in-demo",
            )
        )
    db.commit()


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        _seed_requests(db)


@app.get("/api/health", tags=["Workspace"])
def health():
    return {"status": "ok", "mode": "local-demo", "database": str(DATABASE_PATH)}


@app.get("/api/summary", tags=["Workspace"])
def get_summary(db: Session = Depends(get_db)):
    runs = db.query(ReplayRun).all()
    completed = [run for run in runs if run.status == "completed"]
    total_requests = sum(run.processed_count for run in completed)
    total_diffs = sum(run.diff_count for run in completed)
    all_results = db.query(TrafficDiffResult).all()
    candidate_latencies = [result.candidate_latency_ms for result in all_results]
    candidate_latencies.sort()
    percentile_index = max(0, math.ceil(0.95 * len(candidate_latencies)) - 1)
    p95 = candidate_latencies[percentile_index] if candidate_latencies else None
    baseline_latencies = sorted(result.baseline_latency_ms for result in all_results)
    baseline_p95 = baseline_latencies[percentile_index] if baseline_latencies else None

    service_stats = {}
    for result, captured in (
        db.query(TrafficDiffResult, CapturedRequest)
        .join(CapturedRequest, CapturedRequest.id == TrafficDiffResult.captured_request_id)
        .all()
    ):
        bucket = service_stats.setdefault(captured.service, {"requests": 0, "diffs": 0})
        bucket["requests"] += 1
        bucket["diffs"] += int(result.has_diff)
    services = [
        {
            "name": name,
            "requests": values["requests"],
            "diffs": values["diffs"],
            "rate": round(values["diffs"] / values["requests"] * 100, 2),
        }
        for name, values in service_stats.items()
    ]
    services.sort(key=lambda service: service["rate"], reverse=True)

    chart = [0] * 24
    since = datetime.utcnow() - timedelta(hours=24)
    for run in runs:
        if run.created_at >= since and run.status == "completed":
            hours_ago = min(23, int((datetime.utcnow() - run.created_at).total_seconds() // 3600))
            chart[23 - hours_ago] += run.processed_count

    return {
        "total_requests": total_requests,
        "diff_count": total_diffs,
        "diff_rate": round(total_diffs / total_requests * 100, 2) if total_requests else 0,
        "p95_latency_ms": round(p95, 2) if p95 is not None else None,
        "baseline_p95_latency_ms": round(baseline_p95, 2) if baseline_p95 is not None else None,
        "active_runs": sum(run.status in {"queued", "running"} for run in runs),
        "captured_requests": db.query(CapturedRequest).count(),
        "runs_count": len(runs),
        "services": services[:6],
        "hourly_requests": chart,
    }


@app.get("/api/traffic", tags=["Captured traffic"])
def list_traffic(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(CapturedRequest)
        .order_by(CapturedRequest.recorded_at.desc(), CapturedRequest.id.desc())
        .limit(limit)
        .all()
    )
    return {
        "total": db.query(CapturedRequest).count(),
        "items": [
            {
                "id": row.id,
                "service": row.service,
                "method": row.method,
                "path": row.path,
                "query": _loads(row.query_json, {}),
                "body": _loads(row.body_json),
                "source": row.source,
                "recorded_at": row.recorded_at.isoformat(),
            }
            for row in rows
        ],
    }


@app.post("/api/traffic", status_code=201, tags=["Captured traffic"])
def record_traffic(payload: RecordTrafficRequest, db: Session = Depends(get_db)):
    if payload.batch:
        if not isinstance(payload.body, list):
            raise HTTPException(status_code=422, detail="Batch capture requires a top-level JSON array.")
        if not payload.body or len(payload.body) > 100:
            raise HTTPException(status_code=422, detail="A batch must contain between 1 and 100 requests.")
        bodies = payload.body
    else:
        bodies = [payload.body]

    rows = []
    for body in bodies:
        method, path, query, headers, safe_body = sanitize_capture(
            payload.method, payload.path, payload.query, payload.headers, body
        )
        rows.append(
            CapturedRequest(
                service=payload.service.strip(),
                method=method,
                path=path,
                query_json=_json(query),
                headers_json=_json(headers),
                body_json=_json(safe_body) if safe_body is not None else None,
                source=payload.source.strip(),
            )
        )
    db.add_all(rows)
    db.commit()
    for row in rows:
        db.refresh(row)
    return {
        "id": rows[0].id,
        "created": len(rows),
        "ids": [row.id for row in rows],
        "service": rows[0].service,
        "method": rows[0].method,
        "path": rows[0].path,
    }


@app.post("/api/runs", status_code=202, tags=["Replay runs"])
def create_run(
    payload: CreateReplayRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if db.query(CapturedRequest).count() == 0:
        raise HTTPException(status_code=409, detail="Capture at least one request before creating a replay.")
    run = ReplayRun(
        id=f"rp_{uuid4().hex[:12]}",
        name=payload.name.strip(),
        status="queued",
        request_limit=payload.request_limit,
        concurrency=payload.concurrency,
    )
    db.add(run)
    db.commit()
    background_tasks.add_task(execute_replay, run.id, run.concurrency)
    return _run_summary(run)


@app.get("/api/runs", tags=["Replay runs"])
def list_runs(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    rows = db.query(ReplayRun).order_by(ReplayRun.created_at.desc()).limit(limit).all()
    return {"total": db.query(ReplayRun).count(), "items": [_run_summary(run) for run in rows]}


@app.get("/api/runs/{run_id}", tags=["Replay runs"])
def get_run(run_id: str, db: Session = Depends(get_db)):
    run = db.get(ReplayRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Replay run not found.")
    results = (
        db.query(TrafficDiffResult, CapturedRequest)
        .join(CapturedRequest, CapturedRequest.id == TrafficDiffResult.captured_request_id)
        .filter(TrafficDiffResult.run_id == run_id)
        .order_by(TrafficDiffResult.id.asc())
        .all()
    )
    return {
        **_run_summary(run),
        "concurrency": run.concurrency,
        "results": [_result_detail(result, captured) for result, captured in results],
    }


@app.post("/api/regressions/from-run/{run_id}", tags=["Regression cases"])
def create_regressions(
    run_id: str,
    payload: GenerateRegressionRequest | None = None,
    db: Session = Depends(get_db),
):
    run = db.get(ReplayRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Replay run not found.")
    query = db.query(TrafficDiffResult).filter(
        TrafficDiffResult.run_id == run_id,
        TrafficDiffResult.has_diff.is_(True),
    )
    if payload and payload.diff_ids is not None:
        query = query.filter(TrafficDiffResult.id.in_(payload.diff_ids))
    diffs = query.all()
    existing_ids = {
        case.source_diff_id
        for case in db.query(RegressionCase).filter(
            RegressionCase.source_diff_id.in_([diff.id for diff in diffs])
        )
    } if diffs else set()
    added = []
    for diff in diffs:
        if diff.id in existing_ids:
            continue
        case = RegressionCase(id=f"tc_{uuid4().hex[:12]}", source_diff_id=diff.id)
        db.add(case)
        added.append(case)
    db.commit()
    return {"created": len(added), "already_saved": len(diffs) - len(added)}


def _regression_items(db):
    rows = (
        db.query(RegressionCase, TrafficDiffResult, CapturedRequest)
        .join(TrafficDiffResult, TrafficDiffResult.id == RegressionCase.source_diff_id)
        .join(CapturedRequest, CapturedRequest.id == TrafficDiffResult.captured_request_id)
        .order_by(RegressionCase.created_at.desc())
        .all()
    )
    cases = []
    for case, result, captured in rows:
        baseline = _loads(result.baseline_response_json, {})
        cases.append(
            {
                "id": case.id,
                "source_diff_id": result.id,
                "run_id": result.run_id,
                "service": captured.service,
                "method": captured.method,
                "path": captured.path,
                "query": _loads(captured.query_json, {}),
                "headers": _loads(captured.headers_json, {}),
                "body": _loads(captured.body_json),
                "expected_status": baseline.get("status_code"),
                "expected_body": baseline.get("body"),
                "created_at": case.created_at.isoformat(),
            }
        )
    return cases


@app.get("/api/regressions", tags=["Regression cases"])
def list_regressions(db: Session = Depends(get_db)):
    cases = _regression_items(db)
    return {"total": len(cases), "items": cases}


@app.get("/api/regressions/export", tags=["Regression cases"])
def export_regressions(
    format: str = Query(default="pytest", pattern="^(pytest|json)$"),
    db: Session = Depends(get_db),
):
    cases = _regression_items(db)
    if format == "json":
        return Response(
            content=json.dumps(cases, indent=2, ensure_ascii=True),
            media_type="application/json",
            headers={"Content-Disposition": 'attachment; filename="shadowtraffic-regressions.json"'},
        )

    embedded = repr(json.dumps(cases, ensure_ascii=True))
    source = f'''"""Generated by ShadowTraffic. Set SHADOWTRAFFIC_BASE_URL to your test service."""
import json
import os

import httpx
import pytest
from urllib.parse import urlparse

CASES = json.loads({embedded})
BASE_URL = os.environ.get("SHADOWTRAFFIC_BASE_URL", "").rstrip("/")


@pytest.mark.parametrize("case", CASES, ids=[case["id"] for case in CASES])
def test_recorded_response_regression(case):
    assert BASE_URL, "Set SHADOWTRAFFIC_BASE_URL to the candidate service under test."
    parsed_base = urlparse(BASE_URL)
    assert parsed_base.scheme in {{"http", "https"}}
    assert parsed_base.hostname in {{"localhost", "127.0.0.1", "::1"}}, "Regression exports are restricted to loopback test targets."
    response = httpx.request(
        case["method"],
        BASE_URL + case["path"],
        params=case["query"],
        headers=case["headers"],
        json=case["body"],
        timeout=5.0,
    )
    assert response.status_code == case["expected_status"]
    assert response.json() == case["expected_body"]
'''
    return PlainTextResponse(
        source,
        media_type="text/x-python",
        headers={"Content-Disposition": 'attachment; filename="test_shadowtraffic_regressions.py"'},
    )
