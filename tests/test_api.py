from collections.abc import Generator
from dataclasses import replace
from pathlib import Path

import bcrypt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import Client, Employee, User
from app.core.config import settings
from app.services import application_service
from app.seed_test_users import (
    CLIENT_ACCOUNTS,
    EMPLOYEE_ACCOUNTS,
    seed_test_users,
)

test_engine = create_engine(
    "sqlite+pysqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    Base.metadata.create_all(test_engine)
    monkeypatch.setattr(
        application_service, "settings", replace(settings, upload_dir=tmp_path)
    )

    def override_get_db() -> Generator[Session, None, None]:
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(test_engine)


def create_client_user(db: Session, email: str = "client@example.com") -> tuple[User, Client]:
    user = User(
        email=email,
        password_hash=bcrypt.hashpw(b"correct horse battery", bcrypt.gensalt()).decode(),
        role="client",
    )
    db.add(user)
    db.flush()
    profile = Client(
        user_id=user.id,
        inn="7700000000",
        company_name="Example LLC",
        client_type="LEGAL_ENTITY",
    )
    db.add(profile)
    db.commit()
    db.refresh(user)
    db.refresh(profile)
    return user, profile


def create_employee_user(db: Session) -> tuple[User, Employee]:
    user = User(
        email="employee@example.com",
        password_hash=bcrypt.hashpw(b"correct horse battery", bcrypt.gensalt()).decode(),
        role="employee",
    )
    db.add(user)
    db.flush()
    profile = Employee(user_id=user.id, full_name="Bank Employee", position="Manager")
    db.add(profile)
    db.commit()
    db.refresh(user)
    db.refresh(profile)
    return user, profile


def bearer_token(client: TestClient, email: str = "client@example.com") -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "correct horse battery"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def application_request() -> dict:
    return {
        "product_type": "credit_line",
        "requested_amount": "1500000.00",
        "requested_term_months": 12,
        "purpose": "Working capital",
        "business_data": {"financials": {"annual_revenue": 5000000}},
    }


def test_login_and_current_user(client: TestClient) -> None:
    with TestSession() as db:
        create_client_user(db)

    token = bearer_token(client)
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "client"
    assert response.json()["client"]["inn"] == "7700000000"
    assert response.json()["employee"] is None


def test_registration_is_not_exposed(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "new@example.com", "password": "some password"},
    )
    assert response.status_code == 404


def test_seed_test_users_is_idempotent_and_accounts_can_login(
    client: TestClient,
) -> None:
    with TestSession() as db:
        assert seed_test_users(db, "local-test-password") == (3, 2)
        assert seed_test_users(db, "local-test-password") == (0, 0)
        db.commit()

    for email, *_ in CLIENT_ACCOUNTS:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "local-test-password"},
        )
        assert response.status_code == 200
        assert response.json()["user"]["role"] == "client"

    for email, *_ in EMPLOYEE_ACCOUNTS:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "local-test-password"},
        )
        assert response.status_code == 200
        assert response.json()["user"]["role"] == "employee"


def test_client_can_create_and_read_only_own_application(client: TestClient) -> None:
    with TestSession() as db:
        create_client_user(db)
        create_client_user(db, "other@example.com")

    token = bearer_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/api/v1/applications", json=application_request(), headers=headers
    )
    assert created.status_code == 201
    data = created.json()
    assert data["status"] == "CHECKING"
    assert data["business_data"]["financials"]["annual_revenue"] == 5000000
    assert data["status_history"][0]["new_status"] == "CHECKING"

    other_token = bearer_token(client, "other@example.com")
    forbidden = client.get(
        f"/api/v1/applications/{data['id']}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert forbidden.status_code == 404


def test_employee_request_info_and_client_fill(client: TestClient) -> None:
    with TestSession() as db:
        create_client_user(db)
        create_employee_user(db)

    client_token = bearer_token(client)
    created = client.post(
        "/api/v1/applications",
        json=application_request(),
        headers={"Authorization": f"Bearer {client_token}"},
    )
    application_id = created.json()["id"]

    employee_token = bearer_token(client, "employee@example.com")
    detail = client.get(
        f"/api/v1/employee/applications/{application_id}",
        headers={"Authorization": f"Bearer {employee_token}"},
    )
    assert detail.status_code == 200
    assert detail.json()["client"]["company_name"] == "Example LLC"
    assert detail.json()["client_id"] > 0

    action = client.post(
        f"/api/v1/employee/applications/{application_id}/action",
        json={
            "action": "REQUEST_INFO",
            "decision_reason_code": "MISSING_DOCUMENT",
            "comment": "Please provide a financial report.",
        },
        headers={"Authorization": f"Bearer {employee_token}"},
    )
    assert action.status_code == 200
    assert action.json()["status"] == "NEEDS_INFO"

    fill = client.patch(
        f"/api/v1/applications/{application_id}/fill",
        json={"business_data": {"financials": {"annual_revenue": 6000000}}},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert fill.status_code == 200
    assert fill.json()["status"] == "CHECKING"
    assert fill.json()["business_data"]["financials"]["annual_revenue"] == 6000000


def test_document_upload_and_download_require_authorization(client: TestClient) -> None:
    with TestSession() as db:
        create_client_user(db)
        create_employee_user(db)

    token = bearer_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/api/v1/applications", json=application_request(), headers=headers
    )
    application_id = created.json()["id"]
    uploaded = client.post(
        f"/api/v1/applications/{application_id}/documents",
        data={"document_type": "financial_report"},
        files={"file": ("report.pdf", b"test pdf content", "application/pdf")},
        headers=headers,
    )
    assert uploaded.status_code == 201
    document = uploaded.json()
    assert document["status"] == "PENDING"
    assert document["file_url"].endswith(f"/documents/{document['id']}/file")

    download = client.get(document["file_url"], headers=headers)
    assert download.status_code == 200
    assert download.content == b"test pdf content"

    unauthorized = client.get(document["file_url"])
    assert unauthorized.status_code == 401
