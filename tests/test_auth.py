from fastapi.testclient import TestClient


CLIENT_EMAIL = "test.client1@example.com"
EMPLOYEE_EMAIL = "test.employee1@example.com"
PASSWORD = "passw"


def test_login_success(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/v1/auth/login",
        json={"email": CLIENT_EMAIL, "password": PASSWORD},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["access_token"]
    assert data["token_type"].lower() == "bearer"


def test_login_wrong_password(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/v1/auth/login",
        json={"email": CLIENT_EMAIL, "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert response.json()["error_code"] == "UNAUTHORIZED"


def test_register_disabled(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/v1/auth/register",
        json={"email": "new@test.com", "password": "password"},
    )
    assert response.status_code in {404, 405}


def test_get_me_unauthorized(auth_client: TestClient) -> None:
    response = auth_client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_get_me_success(auth_client: TestClient) -> None:
    login_response = auth_client.post(
        "/api/v1/auth/login",
        json={"email": CLIENT_EMAIL, "password": PASSWORD},
    )
    token = login_response.json()["access_token"]
    response = auth_client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.json()["user"]["role"] == "client"
    assert response.json()["user"]["email"] == CLIENT_EMAIL
    assert response.json()["client"] is not None


def test_employee_role_access(auth_client: TestClient) -> None:
    employee_response = auth_client.post(
        "/api/v1/auth/login",
        json={"email": EMPLOYEE_EMAIL, "password": PASSWORD},
    )
    employee_token = employee_response.json()["access_token"]
    response = auth_client.get(
        "/api/v1/employee/applications",
        headers={"Authorization": f"Bearer {employee_token}"},
    )
    assert response.status_code == 200

    client_response = auth_client.post(
        "/api/v1/auth/login",
        json={"email": CLIENT_EMAIL, "password": PASSWORD},
    )
    client_token = client_response.json()["access_token"]
    response = auth_client.get(
        "/api/v1/employee/applications",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert response.status_code == 403
