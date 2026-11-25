# ShadowTraffic

ShadowTraffic is a local shadow-traffic demo with a FastAPI API and React dashboard. It records sanitized JSON requests, replays them concurrently against two **loopback-only demo services**, compares responses with DeepDiff, records latency percentiles in SQLite, and exports saved regressions as pytest tests.

## Run locally

Start the API in one terminal:

```powershell
cd backend
py -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Start the dashboard in another:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL (normally `http://127.0.0.1:5173`). The searchable API reference is at `http://127.0.0.1:5173/docs`; use its **Try API** button for the interactive Swagger runner at `/swagger-ui`. The raw OpenAPI schema is at `http://127.0.0.1:8000/openapi.json`. The API seeds a few synthetic requests in `backend/shadow_traffic.db` on first start; use **Record traffic** to add more, then **New replay** to compare the local v1/v2 services.

Run backend unit tests with `pip install -r requirements-dev.txt` followed by `pytest`.

## Safety and scope

This version does not capture production traffic automatically and cannot send replay traffic to arbitrary hosts. The capture API accepts relative routes only; it strips authorization/cookie headers and redacts common credentials and personal-data fields. Replay destinations are fixed to the bundled loopback demo services, concurrency is capped at four, and captured request bodies are limited to 256 KB. This keeps the sample safe to run locally; production deployment needs an authenticated capture agent and a reviewed, explicit target allow-list before connecting real environments.

The capture dialog accepts JSON objects and arrays. A top-level array is treated as a batch by default (up to 100 requests); turn off the batch option to capture the array as one request body. Checkout batches and complaint-shaped objects automatically select the corresponding local demo route. Names, locations, and free-text descriptions are redacted before storage along with credentials and payment data.

Regression exports contain sanitized payloads and compare responses to the recorded baseline. Review generated cases before adding them to a CI repository.
