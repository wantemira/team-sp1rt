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
from app.models import (
    Application,
    ApplicationCheck,
    ApplicationStatusHistory,
    Client,
    Employee,
    User,
)
from app.core.config import settings
from app.services import application_service
from app.services.credit_evaluation import CreditEvaluation
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


def bearer_token(
    client: TestClient,
    email: str = "client@example.com",
    password: str = "correct horse battery",
) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def application_request() -> dict:
    return {
        "product_type": "term_loan",
        "requested_amount": "1500000.00",
        "requested_term_months": 12,
        "purpose": "Working capital",
        "business_data": {"financials": {"annual_revenue": "5000000.00"}},
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


def test_client_can_create_draft_list_and_read_only_own_applications(
    client: TestClient,
) -> None:
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
    assert data["status"] == "DRAFT"
    assert data["version"] == 1
    assert data["business_data"]["financials"]["annual_revenue"] == "5000000.00"
    assert data["status_history"] == [
        {
            "id": data["status_history"][0]["id"],
            "previous_status": None,
            "new_status": "DRAFT",
            "changed_by": "CLIENT",
            "comment": "Draft created.",
            "created_at": data["status_history"][0]["created_at"],
        }
    ]

    second = client.post(
        "/api/v1/applications",
        json={"product_type": "term_loan"},
        headers=headers,
    )
    assert second.status_code == 201
    assert second.json()["requested_amount"] is None
    assert second.json()["requested_term_months"] is None
    assert second.json()["business_data"] == {"financials": {}}
    with TestSession() as db:
        stored = db.get(Application, second.json()["id"])
        assert stored is not None
        assert stored.business_data == {"financials": {}}

    listed = client.get("/api/v1/applications", headers=headers)
    assert listed.status_code == 200
    assert {application["id"] for application in listed.json()} == {
        data["id"],
        second.json()["id"],
    }

    other_token = bearer_token(client, "other@example.com")
    other_created = client.post(
        "/api/v1/applications",
        json={"product_type": "term_loan"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert other_created.status_code == 201

    listed = client.get("/api/v1/applications", headers=headers)
    assert {application["id"] for application in listed.json()} == {
        data["id"],
        second.json()["id"],
    }
    forbidden = client.get(
        f"/api/v1/applications/{data['id']}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert forbidden.status_code == 404


def test_product_amounts_require_ruble_strings_and_valid_term(client: TestClient) -> None:
    with TestSession() as db:
        create_client_user(db)

    token = bearer_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    product = client.get("/api/v1/products")
    assert product.status_code == 200
    assert product.json() == [
        {
            "id": "term_loan",
            "name": "Кредит на оборотные средства",
            "min_amount": "100000.00",
            "max_amount": "5000000.00",
            "terms": [6, 12, 24],
            "disbursement_count": 1,
            "term_type": "fixed",
            "repayment_type": "annuity",
        }
    ]
    invalid_values = [
        {"product_type": "term_loan", "requested_amount": 1000000},
        {"product_type": "term_loan", "requested_amount": "99999.00"},
        {
            "product_type": "term_loan",
            "requested_amount": "1000000.00",
            "requested_term_months": 9,
        },
        {
            "product_type": "term_loan",
            "business_data": {"financials": {"annual_revenue": 5000000}},
        },
    ]
    for payload in invalid_values:
        response = client.post(
            "/api/v1/applications", json=payload, headers=headers
        )
        assert response.status_code == 422


def test_draft_can_be_edited_and_submitted_with_version(client: TestClient) -> None:
    with TestSession() as db:
        create_client_user(db)

    headers = {"Authorization": f"Bearer {bearer_token(client)}"}
    created = client.post(
        "/api/v1/applications",
        json={"product_type": "term_loan"},
        headers=headers,
    )
    assert created.status_code == 201
    application_id = created.json()["id"]

    missing_fields = client.post(
        f"/api/v1/applications/{application_id}/submit?version=1",
        headers=headers,
    )
    assert missing_fields.status_code == 422

    edited = client.patch(
        f"/api/v1/applications/{application_id}",
        json={
            "version": 1,
            "requested_amount": "1000000.00",
            "requested_term_months": 12,
        },
        headers=headers,
    )
    assert edited.status_code == 200
    assert edited.json()["version"] == 2
    assert edited.json()["status"] == "DRAFT"
    assert len(edited.json()["status_history"]) == 1

    stale_edit = client.patch(
        f"/api/v1/applications/{application_id}",
        json={"version": 1, "purpose": "Stale edit"},
        headers=headers,
    )
    assert stale_edit.status_code == 409

    submitted = client.post(
        f"/api/v1/applications/{application_id}/submit?version=2",
        headers=headers,
    )
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "NEEDS_INFO"
    assert submitted.json()["version"] == 3
    assert [
        (entry["previous_status"], entry["new_status"])
        for entry in submitted.json()["status_history"]
    ] == [(None, "DRAFT"), ("DRAFT", "CHECKING"), ("CHECKING", "NEEDS_INFO")]

    edit_after_submit = client.patch(
        f"/api/v1/applications/{application_id}",
        json={"version": 3, "purpose": "No longer editable"},
        headers=headers,
    )
    assert edit_after_submit.status_code == 409


def test_missing_financial_information_can_be_filled_and_rechecked(
    client: TestClient,
) -> None:
    with TestSession() as db:
        seed_test_users(db, "local-test-password")
        db.commit()

    token = bearer_token(
        client, "test.client3@example.com", "local-test-password"
    )
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/api/v1/applications",
        json={
            "product_type": "term_loan",
            "requested_amount": "1000000.00",
            "requested_term_months": 12,
        },
        headers=headers,
    )
    application_id = created.json()["id"]
    submitted = client.post(
        f"/api/v1/applications/{application_id}/submit?version=1",
        headers=headers,
    )
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "NEEDS_INFO"
    assert submitted.json()["business_data"] == {"financials": {}}
    assert {check["check_type"] for check in submitted.json()["checks"]} == {
        "FNS",
        "BKI",
    }
    assert [check["status"] for check in submitted.json()["checks"]] == [
        "TIMEOUT",
        "SUCCESS",
    ]

    fill = client.post(
        f"/api/v1/applications/{application_id}/fill",
        json={
            "version": submitted.json()["version"],
            "business_data": {"financials": {"annual_revenue": "6000000.00"}},
        },
        headers=headers,
    )
    assert fill.status_code == 200
    assert fill.json()["status"] == "APPROVED"
    assert fill.json()["version"] == submitted.json()["version"] + 1
    assert [
        (entry["previous_status"], entry["new_status"])
        for entry in fill.json()["status_history"]
    ][-2:] == [("NEEDS_INFO", "CHECKING"), ("CHECKING", "APPROVED")]
    assert fill.json()["business_data"]["financials"]["annual_revenue"] == "6000000.00"
    assert [check["status"] for check in fill.json()["checks"]][-2:] == [
        "SUCCESS",
        "SUCCESS",
    ]


def test_demo_client_two_is_rejected_by_placeholder_score(client: TestClient) -> None:
    with TestSession() as db:
        seed_test_users(db, "local-test-password")
        db.commit()

    token = bearer_token(
        client, "test.client2@example.com", "local-test-password"
    )
    created = client.post(
        "/api/v1/applications",
        json=application_request(),
        headers={"Authorization": f"Bearer {token}"},
    )
    application_id = created.json()["id"]
    submitted = client.post(
        f"/api/v1/applications/{application_id}/submit?version=1",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "REJECTED"
    assert submitted.json()["score"] == 20
    assert submitted.json()["decision_reason_code"] == "SCORE_BELOW_APPROVAL_THRESHOLD"
    assert submitted.json()["checks"][0]["response_data"] == {
        "is_active": True,
        "business_age_months": 6,
    }
    assert submitted.json()["checks"][1]["response_data"] == {
        "current_overdue_days": 10,
        "monthly_debt_payments": "0.00",
    }


def test_demo_client_one_is_approved(client: TestClient) -> None:
    with TestSession() as db:
        seed_test_users(db, "local-test-password")
        db.commit()

    token = bearer_token(
        client, "test.client1@example.com", "local-test-password"
    )
    created = client.post(
        "/api/v1/applications",
        json=application_request(),
        headers={"Authorization": f"Bearer {token}"},
    )
    submitted = client.post(
        f"/api/v1/applications/{created.json()['id']}/submit?version=1",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert submitted.status_code == 200
    assert submitted.json()["status"] == "APPROVED"
    assert submitted.json()["score"] == 95
    assert submitted.json()["requested_amount"] == "1500000.00"
    assert submitted.json()["checks"][0]["response_data"] == {
        "is_active": True,
        "business_age_months": 36,
    }
    assert submitted.json()["checks"][1]["response_data"] == {
        "current_overdue_days": 0,
        "monthly_debt_payments": "50000.00",
    }


def test_demo_client_three_can_retry_fns_timeout(client: TestClient) -> None:
    with TestSession() as db:
        seed_test_users(db, "local-test-password")
        db.commit()

    client_token = bearer_token(
        client, "test.client3@example.com", "local-test-password"
    )
    created = client.post(
        "/api/v1/applications",
        json=application_request(),
        headers={"Authorization": f"Bearer {client_token}"},
    )
    application_id = created.json()["id"]
    submitted = client.post(
        f"/api/v1/applications/{application_id}/submit?version=1",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "MANUAL_REVIEW"
    assert submitted.json()["checks"][0]["status"] == "TIMEOUT"
    assert submitted.json()["checks"][1]["status"] == "SUCCESS"

    employee_token = bearer_token(
        client, "test.employee1@example.com", "local-test-password"
    )
    retry = client.post(
        f"/api/v1/employee/applications/{application_id}/retry-checks"
        f"?version={submitted.json()['version']}",
        headers={"Authorization": f"Bearer {employee_token}"},
    )
    assert retry.status_code == 200
    assert retry.json()["status"] == "APPROVED"
    assert retry.json()["score"] == 95
    assert retry.json()["version"] == submitted.json()["version"] + 1
    assert [check["status"] for check in retry.json()["checks"]] == [
        "TIMEOUT",
        "SUCCESS",
        "SUCCESS",
        "SUCCESS",
    ]
    assert [
        (entry["previous_status"], entry["new_status"])
        for entry in retry.json()["status_history"]
    ][-2:] == [("MANUAL_REVIEW", "CHECKING"), ("CHECKING", "APPROVED")]

    second_created = client.post(
        "/api/v1/applications",
        json=application_request(),
        headers={"Authorization": f"Bearer {client_token}"},
    )
    second_submitted = client.post(
        f"/api/v1/applications/{second_created.json()['id']}/submit?version=1",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert second_submitted.json()["status"] == "MANUAL_REVIEW"
    assert second_submitted.json()["checks"][0]["status"] == "TIMEOUT"


def test_retry_is_unavailable_after_latest_checks_succeed(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    with TestSession() as db:
        seed_test_users(db, "local-test-password")
        db.commit()

    client_token = bearer_token(
        client, "test.client3@example.com", "local-test-password"
    )
    created = client.post(
        "/api/v1/applications",
        json=application_request(),
        headers={"Authorization": f"Bearer {client_token}"},
    )
    application_id = created.json()["id"]
    submitted = client.post(
        f"/api/v1/applications/{application_id}/submit?version=1",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert submitted.json()["status"] == "MANUAL_REVIEW"

    monkeypatch.setattr(
        application_service,
        "evaluate_credit",
        lambda *_args, **_kwargs: CreditEvaluation(
            status="MANUAL_REVIEW",
            score=65,
            reason_code="SCORE_REQUIRES_MANUAL_REVIEW",
        ),
    )
    employee_token = bearer_token(
        client, "test.employee1@example.com", "local-test-password"
    )
    headers = {"Authorization": f"Bearer {employee_token}"}
    retry = client.post(
        f"/api/v1/employee/applications/{application_id}/retry-checks"
        f"?version={submitted.json()['version']}",
        headers=headers,
    )
    assert retry.status_code == 200
    assert retry.json()["status"] == "MANUAL_REVIEW"
    assert retry.json()["checks"][-2]["status"] == "SUCCESS"
    assert retry.json()["checks"][-1]["status"] == "SUCCESS"

    repeated_retry = client.post(
        f"/api/v1/employee/applications/{application_id}/retry-checks"
        f"?version={retry.json()['version']}",
        headers=headers,
    )
    assert repeated_retry.status_code == 409


def test_approved_application_can_be_issued(client: TestClient) -> None:
    with TestSession() as db:
        create_client_user(db)

    token = bearer_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/api/v1/applications", json=application_request(), headers=headers
    )
    application_id = created.json()["id"]
    submitted = client.post(
        f"/api/v1/applications/{application_id}/submit?version=1",
        headers=headers,
    )
    assert submitted.json()["status"] == "APPROVED"

    issued = client.post(
        f"/api/v1/applications/{application_id}/sign"
        f"?version={submitted.json()['version']}",
        headers=headers,
    )
    assert issued.status_code == 200
    assert issued.json()["status"] == "ISSUED"
    assert [
        (entry["previous_status"], entry["new_status"])
        for entry in issued.json()["status_history"]
    ][-1] == ("APPROVED", "ISSUED")


def test_unexpected_evaluation_error_rolls_back_submission(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    with TestSession() as db:
        create_client_user(db)

    token = bearer_token(client)
    created = client.post(
        "/api/v1/applications",
        json=application_request(),
        headers={"Authorization": f"Bearer {token}"},
    )
    application_id = created.json()["id"]

    def fail_evaluation(*_args: object, **_kwargs: object) -> None:
        raise RuntimeError("unexpected scoring failure")

    monkeypatch.setattr(application_service, "evaluate_credit", fail_evaluation)
    with pytest.raises(RuntimeError, match="unexpected scoring failure"):
        client.post(
            f"/api/v1/applications/{application_id}/submit?version=1",
            headers={"Authorization": f"Bearer {token}"},
        )

    with TestSession() as db:
        application = db.get(Application, application_id)
        assert application is not None
        assert application.status == "DRAFT"
        assert application.version == 1
        assert (
            db.query(ApplicationCheck)
            .filter(ApplicationCheck.application_id == application_id)
            .count()
            == 0
        )
        assert (
            db.query(ApplicationStatusHistory)
            .filter(ApplicationStatusHistory.application_id == application_id)
            .count()
            == 1
        )

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
