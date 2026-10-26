from fastapi.testclient import TestClient

from app.main import app
from app.services import application_service


def owner_headers(client, email="demo.ip@example.com"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": "passw"})
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_missing_financial_fields_have_usable_details_and_do_not_change_application(auth_client):
    headers = owner_headers(auth_client, "test.client1@example.com")
    draft = auth_client.post("/api/v1/applications", headers=headers, json={"product_type": "term_loan", "requested_amount": "1000000.00", "requested_term_months": 24}).json()
    path = f"/api/v1/applications/{draft['id']}"
    submitted = auth_client.post(f"{path}/submit", headers=headers, json={"version": draft["version"]}).json()
    assert submitted["status"] == "NEEDS_INFO"
    missing = auth_client.post(f"{path}/fill", headers=headers, json={"version": submitted["version"], "business_data": {"financials": {"annual_expenses": "100000.00"}}})
    assert missing.status_code == 422
    data = missing.json()
    assert data["error_code"] == "MISSING_FINANCIAL_FIELDS"
    assert data["details"]["missing_fields"] == ["business_data.financials.annual_revenue"]
    assert data["details"]["fields"][0]["field"] == "business_data.financials.annual_revenue"
    current = auth_client.get(path, headers=headers).json()
    assert current["version"] == submitted["version"] and current["status_history"] == submitted["status_history"]


def test_internal_errors_keep_json_contract_without_exposing_details(auth_client, monkeypatch):
    headers = owner_headers(auth_client)

    def fail(*_args):
        raise RuntimeError("private-database-debug-information")

    with monkeypatch.context() as patch:
        patch.setattr(application_service, "get_client_applications", fail)
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.get("/api/v1/applications", headers=headers)
        assert response.status_code == 500 and response.headers["content-type"].startswith("application/json")
        assert response.json()["error_code"] == "INTERNAL_ERROR" and response.json()["details"] is None
        assert "private-database" not in response.text
    assert auth_client.get("/api/v1/applications", headers=headers).status_code == 200


def test_openapi_matches_actual_validation_error_envelope(auth_client):
    schema = auth_client.get("/openapi.json").json()
    for code in ("422", "500"):
        response = schema["paths"]["/api/v1/applications"]["post"]["responses"][code]
        assert response["content"]["application/json"]["schema"]["$ref"].endswith("/ErrorResponse")
