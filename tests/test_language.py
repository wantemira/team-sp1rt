import re

import pytest


@pytest.mark.parametrize("path,payload", [
    ("/api/v1/auth/login", {"email": "not-an-email", "password": "passw"}),
    ("/api/v1/auth/login", {"email": "demo.ip@example.com", "password": "wrong"}),
    ("/api/v1/applications", {"product_type": "wrong"}),
    ("/api/v1/applications", {"product_type": "term_loan", "requested_amount": 1000000}),
    ("/api/v1/applications", {"product_type": "term_loan", "requested_amount": "1.00"}),
    ("/api/v1/applications", {"product_type": "term_loan", "requested_term_months": 7}),
])
def test_errors_and_field_hints_are_russian(auth_client, path, payload):
    login = auth_client.post("/api/v1/auth/login", json={"email": "demo.ip@example.com", "password": "passw"})
    response = auth_client.post(path, headers={"Authorization": f"Bearer {login.json()['access_token']}"}, json=payload)
    assert response.status_code in {401, 422}
    data = response.json()
    assert re.search("[А-Яа-яЁё]", data["message"])
    for field in (data.get("details") or {}).get("fields", []):
        assert re.search("[А-Яа-яЁё]", field["message"])
        assert not re.search("[A-Za-z]", field["message"])


def test_requested_information_and_new_history_use_russian(auth_client):
    login = auth_client.post("/api/v1/auth/login", json={"email": "test.client1@example.com", "password": "passw"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    draft = auth_client.post("/api/v1/applications", headers=headers, json={
        "product_type": "term_loan", "requested_amount": "434444.00", "requested_term_months": 12,
    }).json()
    result = auth_client.post(f"/api/v1/applications/{draft['id']}/submit", headers=headers, json={"version": draft["version"]}).json()
    assert result["status"] == "NEEDS_INFO"
    assert result["info_comment"] == "Заполните запрошенные финансовые показатели."
    assert result["status_history"][0]["comment"] == "Черновик сохранён."
    assert result["status_history"][1]["comment"] == "Заявка отправлена на рассмотрение."


@pytest.mark.parametrize("email,role", [
    ("demo.review@example.com", "client"),
    ("test.employee1@example.com", "employee"),
    ("test.employee2@example.com", "employee"),
])
def test_review_client_and_employee_roles_are_separate(auth_client, email, role):
    response = auth_client.post("/api/v1/auth/login", json={"email": email, "password": "passw"})
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["role"] == role
    assert (data["client"] is not None) == (role == "client")
    assert (data["employee"] is not None) == (role == "employee")
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    assert auth_client.get("/api/v1/employee/applications", headers=headers).status_code == (200 if role == "employee" else 403)
