from decimal import Decimal

import pytest


@pytest.mark.parametrize("action,status,fields", [
    ("APPROVE", "APPROVED", {"approved_amount": "1000000.00"}),
    ("REJECT", "REJECTED", {"decision_reason_code": "EMPLOYEE_RISK_DECLINED"}),
    ("REQUEST_INFO", "NEEDS_INFO", {"decision_reason_code": "MISSING_FINANCIALS", "missing_fields": ["business_data.financials.annual_revenue"]}),
])
def test_seed_profile_runs_real_manual_workflow(auth_client, action, status, fields):
    def login(email):
        response = auth_client.post("/api/v1/auth/login", json={"email": email, "password": "passw"})
        assert response.status_code == 200
        data = response.json()
        return {"Authorization": f"Bearer {data['access_token']}"}, data["user"]["id"]

    owner, _ = login("demo.review@example.com")
    employee, employee_id = login("test.employee1@example.com")
    draft = auth_client.post("/api/v1/applications", headers=owner, json={"product_type": "term_loan", "requested_amount": "1000000.00", "requested_term_months": 24}).json()
    path = f"/api/v1/applications/{draft['id']}"
    submitted = auth_client.post(f"{path}/submit", headers=owner, json={"version": draft["version"]}).json()
    assert submitted["status"] == "MANUAL_REVIEW"
    assert submitted["decision_reason_code"] == "SCORE_REQUIRES_MANUAL_REVIEW"
    assert 40 <= submitted["score"] < 65 and submitted["offer"] is None
    assert len(submitted["scoring_result"]["factors"]) == 5
    employee_path = f"/api/v1/employee/applications/{draft['id']}"
    detail = auth_client.get(employee_path, headers=employee).json()
    assert detail["next_actions"] == ["APPROVE", "REJECT", "REQUEST_INFO"]
    payload = {"action": action, "version": detail["version"], "comment": "Проверены источники и денежный поток", **fields}
    response = auth_client.post(f"{employee_path}/action", headers=employee, json=payload)
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == status and result["version"] > submitted["version"]
    assert result["status_history"][-1]["changed_by_user_id"] == employee_id
    assert auth_client.post(f"{employee_path}/action", headers=employee, json=payload).status_code == 409
    assert len(auth_client.get(path, headers=owner).json()["status_history"]) == len(result["status_history"])

    if action == "APPROVE":
        offer = result["offer"]
        assert offer["amount"] == "1000000.00" and Decimal(offer["dscr"]) >= Decimal("1.35")
        assert result["scoring_result"]["automated_assessment"] == submitted["scoring_result"]
        assert result["approved_rate"] == offer["annual_rate_pct"]
        issued = auth_client.post(f"{path}/sign", headers=owner, json={"version": result["version"]})
        assert issued.status_code == 200 and issued.json()["status"] == "ISSUED"
        assert issued.json()["offer"] == offer
    elif action == "REQUEST_INFO":
        assert result["missing_fields"] == fields["missing_fields"]
        filled = auth_client.post(f"{path}/fill", headers=owner, json={"version": result["version"], "business_data": {"financials": {"annual_revenue": "2400000.00"}}})
        assert filled.status_code == 200 and filled.json()["status"] == "MANUAL_REVIEW"
        assert filled.json()["missing_fields"] == [] and len(filled.json()["checks"]) == 4
    else:
        current = auth_client.get(path, headers=owner).json()
        assert current["offer"] is None and current["next_actions"] == []
        assert current["decision_reason_code"] == fields["decision_reason_code"]
