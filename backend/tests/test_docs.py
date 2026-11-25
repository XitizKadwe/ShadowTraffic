from app.main import app, custom_docs


def test_custom_docs_keep_swagger_interactive_and_add_shadowtraffic_branding():
    response = custom_docs()
    html = response.body.decode("utf-8")

    assert response.status_code == 200
    assert "shadowtraffic" in html
    assert "docs-theme.css" in html
    assert "SwaggerUIBundle" in html
    assert '"tryItOutEnabled": true' in html
    assert '"docExpansion": "none"' in html


def test_openapi_operations_are_grouped_into_product_areas():
    schema = app.openapi()
    operation_ids = [
        operation["operationId"]
        for path in schema["paths"].values()
        for operation in path.values()
        if "operationId" in operation
    ]

    assert schema["paths"]["/api/traffic"]["post"]["tags"] == ["Captured traffic"]
    assert schema["paths"]["/api/runs"]["post"]["tags"] == ["Replay runs"]
    assert schema["paths"]["/demo/v1/{path}"]["post"]["tags"] == ["Demo services v1"]
    assert len(operation_ids) == len(set(operation_ids))
    assert all(
        operation.get("tags")
        for path in schema["paths"].values()
        for operation in path.values()
        if "operationId" in operation
    )
