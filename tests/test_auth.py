import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

CLIENT_EMAIL = "test.client1@example.com"
CLIENT_PASSWORD = "passw"
EMPLOYEE_EMAIL = "test.employee1@example.com"
EMPLOYEE_PASSWORD = "passw"


def test_login_success():
    """Успешный вход по email и password"""
    response = client.post("/api/v1/auth/login", json={
        "email": CLIENT_EMAIL,
        "password": CLIENT_PASSWORD
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    # Игнорируем регистр букв (Bearer или bearer)
    assert data["token_type"].lower() == "bearer"


def test_login_wrong_password():
    response = client.post("/api/v1/auth/login", json={
        "email": CLIENT_EMAIL,
        "password": "wrongpassword"
    })
    assert response.status_code == 401
    assert response.json()["error_code"] == "UNAUTHORIZED"


def test_register_disabled():
    # 404 - потому что ручки нет, 405 - если метод запрещен. Главное, что не 200.
    response = client.post("/api/v1/auth/register", json={
        "email": "new@test.com",
        "password": "password"
    })
    assert response.status_code in [404, 405] 


def test_get_me_unauthorized():
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_get_me_success():
    """С токеном ручка /me возвращает данные пользователя"""
    login_resp = client.post("/api/v1/auth/login", json={
        "email": CLIENT_EMAIL,
        "password": CLIENT_PASSWORD
    })
    token = login_resp.json()["access_token"]
    
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["user"]["role"] == "client"
    assert data["user"]["email"] == CLIENT_EMAIL
    assert data["client"] is not None  # Профиль клиента должен быть


def test_employee_role_access():
    # Логин сотрудника
    emp_resp = client.post("/api/v1/auth/login", json={
        "email": EMPLOYEE_EMAIL,
        "password": EMPLOYEE_PASSWORD
    })
    emp_token = emp_resp.json()["access_token"]
    
    response = client.get("/api/v1/employee/applications", headers={"Authorization": f"Bearer {emp_token}"})
    assert response.status_code == 200
    
    # Логин клиента
    client_resp = client.post("/api/v1/auth/login", json={
        "email": CLIENT_EMAIL,
        "password": CLIENT_PASSWORD
    })
    client_token = client_resp.json()["access_token"]
    
    # Клиент стучится в ручку сотрудника - 403
    response = client.get("/api/v1/employee/applications", headers={"Authorization": f"Bearer {client_token}"})
    assert response.status_code == 403