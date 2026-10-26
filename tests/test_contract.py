import pytest
from pydantic import ValidationError

from app.schemas.applications import ApplicationCreate, ApplicationVersion, EmployeeActionRequest


@pytest.mark.parametrize("version", [True, False, "1", 1.0, 0, -1])
def test_json_version_requires_a_positive_integer(version):
    with pytest.raises(ValidationError):
        ApplicationVersion(version=version)


@pytest.mark.parametrize("business_data", [
    {"annual_revenue": "1000000.00"},
    {"financials": {"annual_revenu": "1000000.00"}},
])
def test_misspelled_financial_fields_are_not_silently_discarded(business_data):
    with pytest.raises(ValidationError):
        ApplicationCreate(product_type="term_loan", business_data=business_data)


@pytest.mark.parametrize("payload", [
    {"action": "APPROVE", "approved_amount": "500000.00", "comment": "   "},
    {"action": "REJECT", "decision_reason_code": "  "},
    {"action": "REJECT", "decision_reason_code": "POLICY", "approved_amount": "500000.00"},
    {"action": "APPROVE", "approved_amount": "500000.00", "missing_fields": []},
    {"action": "REQUEST_INFO", "missing_fields": ["business_data.financials.annual_revenue"]},
])
def test_contradictory_or_empty_manual_decisions_are_rejected(payload):
    with pytest.raises(ValidationError):
        EmployeeActionRequest.model_validate({"version": 1, "comment": "Проверено", **payload})


def test_manual_decision_normalizes_comment_and_reason():
    decision = EmployeeActionRequest(action="REJECT", version=1, comment=" Проверено ", decision_reason_code=" POLICY ")
    assert decision.comment == "Проверено"
    assert decision.decision_reason_code == "POLICY"


def test_invalid_json_version_does_not_submit_a_draft(auth_client):
    token = auth_client.post("/api/v1/auth/login", json={"email": "demo.ip@example.com", "password": "passw"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    draft = auth_client.post("/api/v1/applications", headers=headers, json={"product_type": "term_loan", "requested_amount": "1000000.00", "requested_term_months": 24}).json()
    path = f"/api/v1/applications/{draft['id']}"
    assert auth_client.post(f"{path}/submit", headers=headers, json={"version": True}).status_code == 422
    current = auth_client.get(path, headers=headers).json()
    assert (current["status"], current["version"], current["checks"]) == ("DRAFT", 1, [])
    schema = auth_client.get("/openapi.json").json()
    assert schema["paths"]["/api/v1/products"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]["items"]["$ref"].endswith("/ProductResponse")
