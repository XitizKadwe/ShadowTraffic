import pytest
from fastapi import HTTPException

from app.demo_services import response_for
from app.privacy import sanitize_capture
from app.replay_engine import _differences, _percentile_95


def test_capture_redacts_sensitive_fields_and_keeps_safe_headers():
    method, path, query, headers, body = sanitize_capture(
        "post",
        "/checkout",
        {"coupon": "SAVE", "access_token": "do-not-store"},
        {"Authorization": "Bearer secret", "Content-Type": "application/json"},
        {"coupon_code": None, "email": "person@example.test", "amount": 12.5},
    )

    assert method == "POST"
    assert path == "/checkout"
    assert query == {"coupon": "SAVE", "access_token": "[REDACTED]"}
    assert headers == {"content-type": "application/json"}
    assert body == {"coupon_code": None, "email": "[REDACTED]", "amount": 12.5}


def test_capture_redacts_personal_fields_in_nested_and_batch_payloads():
    _, _, _, _, body = sanitize_capture(
        "POST",
        "/api/v1/complaints",
        {},
        {},
        [{"citizen_name": "Example Citizen", "ward": "Zone-4", "description": "Personal report"}],
    )

    assert body == [{
        "citizen_name": "[REDACTED]",
        "ward": "[REDACTED]",
        "description": "[REDACTED]",
    }]


@pytest.mark.parametrize("path", ["https://example.test/checkout", "//example.test/path", "/../admin", "/%2e%2e/admin"])
def test_capture_rejects_non_application_paths(path):
    with pytest.raises(HTTPException):
        sanitize_capture("GET", path, {}, {}, None)


def test_demo_versions_report_field_drift_and_ignore_array_order():
    payload = {"amount": 12.5, "coupon_code": None, "customer_type": "GOV_PSU"}
    v1 = response_for(1, "checkout", "POST", payload, {})
    v2 = response_for(2, "checkout", "POST", payload, {})

    changes = _differences({"status_code": 200, "body": v1}, {"status_code": 200, "body": v2})
    assert any("total" in change["path"] for change in changes)
    assert any("currency" in change["path"] for change in changes)
    removed_field = next(change for change in changes if "gst_applied" in change["path"])
    assert removed_field["old_value"] is False
    assert removed_field["new_value"] == "[missing]"

    search_v1 = response_for(1, "search", "GET", None, {"q": "wireless"})
    search_v2 = response_for(2, "search", "GET", None, {"q": "wireless"})
    assert _differences(search_v1, search_v2) == []


def test_checkout_demo_processes_each_item_in_a_batch():
    payload = [
        {"amount": 120.5, "coupon_code": None, "customer_type": "GOV_PSU", "tax": 18.28},
        {"amount": 999.0, "coupon_code": "SAVE20", "customer_type": "ENTERPRISE", "tax": 179.82},
        {"amount": 499.0, "coupon_code": "WELCOME10", "customer_type": "PRO", "tax": 89.82},
    ]

    v1 = response_for(1, "api/v1/checkout", "POST", payload, {})
    v2 = response_for(2, "api/v2/checkout", "POST", payload, {})

    assert len(v1["data"]) == len(payload)
    assert [item["total"] for item in v1["data"]] == [120.5, 999.0, 499.0]
    assert [item["gst_applied"] for item in v1["data"]] == [False, True, True]
    assert len(_differences(v1, v2)) > 0


def test_complaint_demo_reports_schema_drift():
    payload = {
        "ticket_id": "GRV-TEST-441",
        "is_urgent": True,
        "attachments": ["photo.jpg"],
    }

    v1 = response_for(1, "api/v1/complaints", "POST", payload, {})
    v2 = response_for(2, "api/v2/complaints", "POST", payload, {})
    differences = _differences(v1, v2)

    assert v1["data"]["is_urgent"] is True
    assert v2["data"]["urgent"] is True
    assert any("attachment_count" in change["path"] for change in differences)
    assert any("is_urgent" in change["path"] for change in differences)


def test_p95_uses_nearest_rank_for_small_samples():
    assert _percentile_95([4, 1, 3, 2]) == 4
    assert _percentile_95([]) is None

