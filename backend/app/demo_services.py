from fastapi import APIRouter, HTTPException, Request


router = APIRouter()
SUPPORTED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]


async def _payload(request: Request):
    if request.method in {"GET", "DELETE"}:
        return None
    if not request.headers.get("content-type", "").startswith("application/json"):
        return None
    try:
        return await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Request body must be valid JSON.") from exc


def response_for(version: int, path: str, method: str, payload, query):
    segments = path.split("/")
    if segments and segments[0] == "api":
        segments = segments[1:]
        if segments and segments[0] in {"v1", "v2"}:
            segments = segments[1:]
    path = "/".join(segments)

    if path == "checkout":
        def checkout_result(item):
            body = item if isinstance(item, dict) else {}
            amount = body.get("amount", 128.5)
            tax = float(body.get("tax", 10.28))
            if version == 1:
                return {
                    "total": amount,
                    "currency": "USD",
                    "gst_applied": body.get("customer_type") != "GOV_PSU",
                    "coupon_code": body.get("coupon_code"),
                    "items": [{"sku": "demo-1", "tax": tax}],
                }
            data = {
                "total": str(amount),
                "currency": "usd",
                "coupon_code": body.get("coupon_code"),
                "items": [{"sku": "demo-1", "tax": round(tax - 0.01, 2)}],
            }
            if body.get("customer_type") != "GOV_PSU":
                data["gst_applied"] = True
            return data

        if isinstance(payload, list):
            return {"data": [checkout_result(item) for item in payload]}
        return {"data": checkout_result(payload)}

    if path.startswith("users/"):
        user_id = path.split("/", 1)[1]
        return {"data": {"id": user_id, "name": "Demo User", "active": True}}

    if path.startswith("inventory/"):
        sku = path.split("/", 1)[1]
        quantity = 18 if version == 1 else 17
        return {"data": {"sku": sku, "available": quantity, "warehouse": "west-1"}}

    if path == "complaints":
        body = payload if isinstance(payload, dict) else {}
        if version == 1:
            return {
                "data": {
                    "ticket_id": body.get("ticket_id"),
                    "status": "received",
                    "is_urgent": body.get("is_urgent", False),
                    "attachments": body.get("attachments", []),
                }
            }
        return {
            "data": {
                "ticket_id": body.get("ticket_id"),
                "status": "received",
                "urgent": body.get("is_urgent", False),
                "attachment_count": len(body.get("attachments", [])),
            }
        }

    if path == "payments/authorize":
        body = payload if isinstance(payload, dict) else {}
        result = {
            "authorized": True,
            "amount": body.get("amount", 84.25),
            "currency": "USD",
            "gst_applied": body.get("customer_type") != "GOV_PSU",
        }
        if version == 2:
            result["amount"] = str(result["amount"])
            if body.get("customer_type") == "GOV_PSU":
                result.pop("gst_applied")
        return {"data": result}

    if path == "search":
        term = query.get("q", "demo")
        items = [{"id": "item-1", "title": f"{term} results"}, {"id": "item-2", "title": "More results"}]
        if version == 2:
            items.reverse()
        return {"data": {"items": items, "total": 2}}

    return {
        "data": {
            "service_version": version,
            "method": method,
            "path": path,
            "query": query,
            "payload": payload,
        }
    }


async def demo_v1(path: str, request: Request):
    return response_for(1, path, request.method, await _payload(request), dict(request.query_params))


async def demo_v2(path: str, request: Request):
    return response_for(2, path, request.method, await _payload(request), dict(request.query_params))


for method in SUPPORTED_METHODS:
    router.add_api_route(
        "/demo/v1/{path:path}",
        demo_v1,
        methods=[method],
        name=f"demo_v1_{method.lower()}",
        operation_id=f"demo_v1_{method.lower()}",
        tags=["Demo services v1"],
    )
    router.add_api_route(
        "/demo/v2/{path:path}",
        demo_v2,
        methods=[method],
        name=f"demo_v2_{method.lower()}",
        operation_id=f"demo_v2_{method.lower()}",
        tags=["Demo services v2"],
    )
