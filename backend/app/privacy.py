import json
import re
from typing import Any
from urllib.parse import unquote

from fastapi import HTTPException


ALLOWED_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}
SENSITIVE_FIELDS = {
    "access_token",
    "api_key",
    "authorization",
    "card_number",
    "cardnumber",
    "citizen_name",
    "cookie",
    "cvv",
    "description",
    "email",
    "full_name",
    "name",
    "password",
    "phone",
    "refresh_token",
    "secret",
    "set-cookie",
    "set_cookie",
    "token",
    "ward",
    "address",
    "location",
}
ALLOWED_REPLAY_HEADERS = {"accept", "content-type"}


def redact_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "[REDACTED]" if key.lower().replace("-", "_") in SENSITIVE_FIELDS else redact_value(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact_value(item) for item in value]
    return value


def sanitize_capture(method: str, path: str, query: dict, headers: dict, body: Any) -> tuple:
    clean_method = method.upper()
    if clean_method not in ALLOWED_METHODS:
        raise HTTPException(status_code=422, detail="Only standard application HTTP methods can be captured.")

    decoded_path = unquote(path)
    if (
        not path.startswith("/")
        or path.startswith("//")
        or "?" in path
        or "#" in path
        or "\\" in decoded_path
        or any(part in {".", ".."} for part in decoded_path.split("/"))
        or "\x00" in decoded_path
    ):
        raise HTTPException(status_code=422, detail="Path must be a relative application route, not a URL.")

    safe_query = {
        key: "[REDACTED]" if key.lower().replace("-", "_") in SENSITIVE_FIELDS else str(value)
        for key, value in query.items()
    }
    safe_headers = {
        key.lower(): value
        for key, value in headers.items()
        if key.lower() in ALLOWED_REPLAY_HEADERS
    }
    if any(len(value) > 256 or "\r" in value or "\n" in value for value in safe_headers.values()):
        raise HTTPException(status_code=422, detail="Captured header values are too long or contain invalid characters.")
    safe_body = redact_value(body)
    try:
        serialized = json.dumps(safe_body, ensure_ascii=True)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Request body must be JSON serializable.") from exc
    if len(serialized.encode("utf-8")) > 256_000:
        raise HTTPException(status_code=413, detail="Captured JSON body exceeds the 256 KB limit.")
    if re.search(r"[\r\n]", path):
        raise HTTPException(status_code=422, detail="Path contains invalid characters.")
    return clean_method, path, safe_query, safe_headers, safe_body
