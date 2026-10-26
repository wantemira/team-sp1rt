from dataclasses import replace

import pytest

from app.services import application_service


@pytest.mark.parametrize("failure,reason", [
    ("fns_timeout", "EXTERNAL_CHECK_UNAVAILABLE"),
    ("bki_connection", "EXTERNAL_CHECK_UNAVAILABLE"),
    ("fns_incomplete", "EXTERNAL_DATA_INCOMPLETE"),
    ("fns_invalid", "INVALID_SOURCE_DATA"),
    ("bki_incomplete", "EXTERNAL_DATA_INCOMPLETE"),
])
def test_source_failure_is_saved_and_recoverable_without_manual_override(auth_client, monkeypatch, failure, reason):
    def headers(email):
        response = auth_client.post("/api/v1/auth/login", json={"email": email, "password": "passw"})
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    owner, employee = headers("demo.ip@example.com"), headers("test.employee1@example.com")
    get_fns = application_service.fns_mock.get_fns_result
    get_bki = application_service.bki_mock.get_bki_result

    def bad_fns(*args):
        if failure == "fns_timeout":
            raise TimeoutError("Синтетический таймаут")
        result = get_fns(*args)
        if failure == "fns_incomplete":
            return replace(result, is_active=None)
        return replace(result, is_active="false") if failure == "fns_invalid" else result

    def bad_bki(*args):
        if failure == "bki_connection":
            raise ConnectionError("Синтетический обрыв соединения")
        result = get_bki(*args)
        return replace(result, total_payments_12m=None) if failure == "bki_incomplete" else result

    monkeypatch.setattr(application_service.fns_mock, "get_fns_result", bad_fns)
    monkeypatch.setattr(application_service.bki_mock, "get_bki_result", bad_bki)
    draft = auth_client.post("/api/v1/applications", headers=owner, json={"product_type": "term_loan", "requested_amount": "1000000.00", "requested_term_months": 24}).json()
    path = f"/api/v1/applications/{draft['id']}"
    response = auth_client.post(f"{path}/submit", headers=owner, json={"version": draft["version"]})
    assert response.status_code == 200
    submitted = response.json()
    assert (submitted["status"], submitted["decision_reason_code"]) == ("MANUAL_REVIEW", reason)
    assert submitted["offer"] is None and len(submitted["checks"]) == 2
    employee_path = f"/api/v1/employee/applications/{draft['id']}"
    assert auth_client.get(employee_path, headers=employee).json()["next_actions"] == ["RETRY_CHECKS"]
    decision = auth_client.post(f"{employee_path}/action", headers=employee, json={"action": "APPROVE", "version": submitted["version"], "approved_amount": "500000.00", "comment": "Попытка обхода источника"})
    assert decision.status_code == 409
    monkeypatch.setattr(application_service.fns_mock, "get_fns_result", get_fns)
    monkeypatch.setattr(application_service.bki_mock, "get_bki_result", get_bki)
    recovered = auth_client.post(f"{employee_path}/retry-checks", headers=employee, json={"version": submitted["version"]})
    assert recovered.status_code == 200
    current = recovered.json()
    assert current["status"] == "APPROVED" and current["offer"] is not None
    assert len(current["checks"]) == 4 and len(current["status_history"]) == len(submitted["status_history"]) + 2
    assert current["version"] > submitted["version"]
    assert auth_client.post(f"{employee_path}/retry-checks", headers=employee, json={"version": current["version"]}).status_code == 409
    assert auth_client.get(path, headers=owner).json()["checks"] == current["checks"]
