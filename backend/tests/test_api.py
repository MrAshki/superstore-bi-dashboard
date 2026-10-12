from __future__ import annotations


def test_health_endpoint(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "dataset_rows": 1163}


def test_root_redirects_to_api_documentation(client):
    response = client.get("/", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/docs"


def test_favicon_request_is_not_a_not_found_error(client):
    response = client.get("/favicon.ico")
    assert response.status_code == 204


def test_metadata_endpoint(client):
    response = client.get("/api/v1/metadata")
    body = response.json()
    assert response.status_code == 200
    assert body["dataset_date_range"] == {"min": "2014-01-04", "max": "2017-12-30"}
    assert len(body["states"]) == 41
    assert all(state["state_code"] for state in body["states"])


def test_dashboard_endpoint_returns_verified_kpis(client):
    response = client.post("/api/v1/dashboard", json={})
    assert response.status_code == 200
    body = response.json()
    assert body["kpis"]["total_sales"] == 278312.01
    assert body["kpis"]["total_profit"] == 27147.41
    assert body["applied_filters"]["regions"] == []
    assert body["profitability"]["kpis"]["high_discount_sales_share"] == 30.42


def test_dashboard_rejects_invalid_date_range(client):
    response = client.post("/api/v1/dashboard", json={"date_from": "2017-01-02", "date_to": "2017-01-01"})
    assert response.status_code == 422


def test_dashboard_rejects_unknown_dimension_value(client):
    response = client.post("/api/v1/dashboard", json={"categories": ["Unknown"]})
    assert response.status_code == 422


def test_cors_allows_local_nextjs_development(client):
    response = client.options(
        "/api/v1/dashboard",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
