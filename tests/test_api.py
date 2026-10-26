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
from app.integrations.fns_mock import FNSResult
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
        assert seed_test_users(db, "local-test-password") == (4, 2)
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
    assert data["next_actions"] == ["EDIT", "SUBMIT"]
    assert data["business_data"]["financials"]["annual_revenue"] == "5000000.00"
    assert data["status_history"] == [
        {
            "id": data["status_history"][0]["id"],
            "previous_status": None,
            "new_status": "DRAFT",
            "changed_by": "CLIENT",
            "changed_by_user_id": data["status_history"][0]["changed_by_user_id"],
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
    assert submitted.json()["next_actions"] == ["FILL"]
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
        client, "test.client1@example.com", "local-test-password"
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
    assert submitted.json()["next_actions"] == ["FILL"]
    assert submitted.json()["business_data"] == {"financials": {}}
    assert {check["check_type"] for check in submitted.json()["checks"]} == {
        "FNS",
        "BKI",
    }
    assert [check["status"] for check in submitted.json()["checks"]] == [
        "SUCCESS",
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
    assert fill.json()["next_actions"] == ["SIGN"]
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


def test_fill_requires_each_requested_field(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    with TestSession() as db:
        create_client_user(db)
        employee, _ = create_employee_user(db)
        employee_id = employee.id

    monkeypatch.setattr(
        application_service,
        "evaluate_credit",
        lambda *_args, **_kwargs: CreditEvaluation(
            status="MANUAL_REVIEW",
            score=65,
            reason_code="SCORE_REQUIRES_MANUAL_REVIEW",
        ),
    )
    client_token = bearer_token(client)
    client_headers = {"Authorization": f"Bearer {client_token}"}
    created = client.post(
        "/api/v1/applications",
        json=application_request(),
        headers=client_headers,
    )
    application_id = created.json()["id"]
    submitted = client.post(
        f"/api/v1/applications/{application_id}/submit?version=1",
        headers=client_headers,
    )
    assert submitted.json()["status"] == "MANUAL_REVIEW"
    assert submitted.json()["next_actions"] == []

    employee_token = bearer_token(
        client, "employee@example.com", "correct horse battery"
    )
    employee_headers = {"Authorization": f"Bearer {employee_token}"}
    employee_card = client.get(
        f"/api/v1/employee/applications/{application_id}",
        headers=employee_headers,
    )
    assert employee_card.json()["next_actions"] == [
        "APPROVE",
        "REJECT",
        "REQUEST_INFO",
    ]
    requested = client.post(
        f"/api/v1/employee/applications/{application_id}/action",
        json={
            "action": "REQUEST_INFO",
            "version": submitted.json()["version"],
            "decision_reason_code": "ADDITIONAL_FINANCIALS_REQUIRED",
            "missing_fields": ["business_data.financials.annual_expenses"],
            "comment": "Укажите годовые расходы.",
        },
        headers=employee_headers,
    )
    assert requested.status_code == 200
    assert requested.json()["missing_fields"] == [
        "business_data.financials.annual_expenses"
    ]
    assert requested.json()["info_comment"] == "Укажите годовые расходы."
    assert requested.json()["status_history"][-1]["changed_by_user_id"] == employee_id

    fill_path = f"/api/v1/applications/{application_id}/fill"
    unrequested_only = client.post(
        fill_path,
        json={
            "version": requested.json()["version"],
            "business_data": {"financials": {"annual_revenue": "7000000.00"}},
        },
        headers=client_headers,
    )
    assert unrequested_only.status_code == 422

    null_requested_value = client.post(
        fill_path,
        json={
            "version": requested.json()["version"],
            "business_data": {"financials": {"annual_expenses": None}},
        },
        headers=client_headers,
    )
    assert null_requested_value.status_code == 422

    filled = client.post(
        fill_path,
        json={
            "version": requested.json()["version"],
            "business_data": {"financials": {"annual_expenses": "0.00"}},
        },
        headers=client_headers,
    )
    assert filled.status_code == 200
    assert filled.json()["status"] == "MANUAL_REVIEW"
    assert filled.json()["missing_fields"] == []
    assert filled.json()["info_comment"] is None
    assert filled.json()["business_data"]["financials"]["annual_expenses"] == "0.00"


def test_manual_approval_uses_fixed_rate_and_sign_records_issuance(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    with TestSession() as db:
        create_client_user(db)
        employee, _ = create_employee_user(db)
        employee_id = employee.id

    monkeypatch.setattr(
        application_service,
        "evaluate_credit",
        lambda *_args, **_kwargs: CreditEvaluation(
            status="MANUAL_REVIEW",
            score=65,
            reason_code="SCORE_REQUIRES_MANUAL_REVIEW",
        ),
    )
    client_token = bearer_token(client)
    client_headers = {"Authorization": f"Bearer {client_token}"}
    created = client.post(
        "/api/v1/applications",
        json=application_request(),
        headers=client_headers,
    )
    application_id = created.json()["id"]
    submitted = client.post(
        f"/api/v1/applications/{application_id}/submit?version=1",
        headers=client_headers,
    )
    assert submitted.json()["status"] == "MANUAL_REVIEW"

    employee_token = bearer_token(
        client, "employee@example.com", "correct horse battery"
    )
    employee_headers = {"Authorization": f"Bearer {employee_token}"}
    excessive_amount = client.post(
        f"/api/v1/employee/applications/{application_id}/action",
        json={
            "action": "APPROVE",
            "version": submitted.json()["version"],
            "approved_amount": "1500000.01",
            "comment": "Сумма превышает запрошенную.",
        },
        headers=employee_headers,
    )
    assert excessive_amount.status_code == 422

    decision = client.post(
        f"/api/v1/employee/applications/{application_id}/action",
        json={
            "action": "APPROVE",
            "version": submitted.json()["version"],
            "approved_amount": "1000000.00",
            "comment": "Проверки успешны, стоп-факторов нет.",
        },
        headers=employee_headers,
    )
    assert decision.status_code == 200
    assert decision.json()["status"] == "APPROVED"
    assert decision.json()["approved_rate"] == "28.0000"
    assert decision.json()["status_history"][-1]["changed_by_user_id"] == employee_id

    issued = client.post(
        f"/api/v1/applications/{application_id}/sign"
        f"?version={decision.json()['version']}",
        headers=client_headers,
    )
    assert issued.status_code == 200
    assert issued.json()["status"] == "ISSUED"
    assert issued.json()["signed_at"] is not None
    assert issued.json()["issued_at"] == issued.json()["signed_at"]
    assert issued.json()["status_history"][-1]["changed_by"] == "CLIENT"
    assert issued.json()["next_actions"] == []

    history_count = len(issued.json()["status_history"])
    signed_at = issued.json()["signed_at"]
    repeated_sign = client.post(
        f"/api/v1/applications/{application_id}/sign"
        f"?version={issued.json()['version']}",
        headers=client_headers,
    )
    assert repeated_sign.status_code == 409
    latest_card = client.get(
        f"/api/v1/applications/{application_id}",
        headers=client_headers,
    )
    assert latest_card.json()["status"] == "ISSUED"
    assert latest_card.json()["signed_at"].removesuffix("Z") == (
        signed_at.removesuffix("Z")
    )
    assert len(latest_card.json()["status_history"]) == history_count
    assert latest_card.json()["next_actions"] == []


def test_technical_check_failure_cannot_be_decided_until_retry(
    client: TestClient,
) -> None:
    with TestSession() as db:
        seed_test_users(db, "local-test-password")
        db.commit()

    client_token = bearer_token(
        client, "test.client3@example.com", "local-test-password"
    )
    client_headers = {"Authorization": f"Bearer {client_token}"}
    created = client.post(
        "/api/v1/applications",
        json=application_request(),
        headers=client_headers,
    )
    application_id = created.json()["id"]
    submitted = client.post(
        f"/api/v1/applications/{application_id}/submit?version=1",
        headers=client_headers,
    )
    assert submitted.json()["status"] == "MANUAL_REVIEW"
    assert submitted.json()["decision_reason_code"] == "EXTERNAL_CHECK_UNAVAILABLE"

    employee_token = bearer_token(
        client, "test.employee1@example.com", "local-test-password"
    )
    employee_card = client.get(
        f"/api/v1/employee/applications/{application_id}",
        headers={"Authorization": f"Bearer {employee_token}"},
    )
    assert employee_card.json()["next_actions"] == ["RETRY_CHECKS"]
    blocked = client.post(
        f"/api/v1/employee/applications/{application_id}/action",
        json={
            "action": "APPROVE",
            "version": submitted.json()["version"],
            "approved_amount": "1000000.00",
            "comment": "Cannot approve before checks complete.",
        },
        headers={"Authorization": f"Bearer {employee_token}"},
    )
    assert blocked.status_code == 409


def test_repeated_check_failure_keeps_technical_manual_review(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    with TestSession() as db:
        seed_test_users(db, "local-test-password")
        db.commit()

    client_token = bearer_token(
        client, "test.client3@example.com", "local-test-password"
    )
    headers = {"Authorization": f"Bearer {client_token}"}
    created = client.post(
        "/api/v1/applications",
        json=application_request(),
        headers=headers,
    )
    application_id = created.json()["id"]
    submitted = client.post(
        f"/api/v1/applications/{application_id}/submit?version=1",
        headers=headers,
    )
    assert submitted.json()["status"] == "MANUAL_REVIEW"
    assert submitted.json()["decision_reason_code"] == "EXTERNAL_CHECK_UNAVAILABLE"

    monkeypatch.setattr(
        application_service.fns_mock,
        "get_fns_result",
        lambda *_args: FNSResult(
            status="TIMEOUT", is_active=None, business_age_months=None
        ),
    )
    employee_token = bearer_token(
        client, "test.employee1@example.com", "local-test-password"
    )
    retried = client.post(
        f"/api/v1/employee/applications/{application_id}/retry-checks"
        f"?version={submitted.json()['version']}",
        headers={"Authorization": f"Bearer {employee_token}"},
    )
    assert retried.status_code == 200
    assert retried.json()["status"] == "MANUAL_REVIEW"
    assert retried.json()["decision_reason_code"] == "EXTERNAL_CHECK_UNAVAILABLE"
    assert retried.json()["checks"][-2]["status"] == "TIMEOUT"


def test_known_stop_factor_blocks_manual_approval(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    with TestSession() as db:
        seed_test_users(db, "local-test-password")
        db.commit()

    monkeypatch.setattr(
        application_service,
        "evaluate_credit",
        lambda *_args, **_kwargs: CreditEvaluation(
            status="MANUAL_REVIEW",
            score=65,
            reason_code="SCORE_REQUIRES_MANUAL_REVIEW",
        ),
    )
    client_token = bearer_token(
        client, "test.client2@example.com", "local-test-password"
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

    employee_token = bearer_token(
        client, "test.employee1@example.com", "local-test-password"
    )
    blocked = client.post(
        f"/api/v1/employee/applications/{application_id}/action",
        json={
            "action": "APPROVE",
            "version": submitted.json()["version"],
            "approved_amount": "1000000.00",
            "comment": "Попытка одобрить заявку со стоп-фактором.",
        },
        headers={"Authorization": f"Bearer {employee_token}"},
    )
    assert blocked.status_code == 409


def test_demo_client_two_is_rejected_by_stop_factor(client: TestClient) -> None:
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
    assert submitted.json()["score"] is None
    assert submitted.json()["decision_reason_code"] == "BUSINESS_TOO_YOUNG"
    assert {key: submitted.json()["checks"][0]["response_data"][key]
            for key in ("is_active", "business_age_months")} == {
        "is_active": True,
        "business_age_months": 6,
    }
    assert {key: submitted.json()["checks"][1]["response_data"][key]
            for key in ("current_overdue_days", "monthly_debt_payments")} == {
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
    assert submitted.json()["next_actions"] == ["SIGN"]
    assert submitted.json()["score"] == 85
    assert submitted.json()["scoring_result"]["model"] == "cash-flow-demo-v1"
    assert submitted.json()["scoring_result"]["score"] == 85
    assert submitted.json()["scoring_result"]["reason_code"] == (
        "AFFORDABLE_COUNTER_OFFER"
    )
    with TestSession() as db:
        stored = db.get(Application, created.json()["id"])
        assert stored is not None
        assert stored.scoring_result == submitted.json()["scoring_result"]
    assert submitted.json()["requested_amount"] == "1500000.00"
    assert {key: submitted.json()["checks"][0]["response_data"][key]
            for key in ("is_active", "business_age_months")} == {
        "is_active": True,
        "business_age_months": 36,
    }
    assert {key: submitted.json()["checks"][1]["response_data"][key]
            for key in ("current_overdue_days", "monthly_debt_payments")} == {
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
    assert retry.json()["score"] == 85
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


def test_demo_ip_counter_offer_is_persisted_and_accepted_once(client: TestClient) -> None:
    from decimal import Decimal
    with TestSession() as db:
        seed_test_users(db, "local-test-password")
        db.commit()
    headers = {"Authorization": f"Bearer {bearer_token(client, 'demo.ip@example.com', 'local-test-password')}"}
    profile = client.get("/api/v1/auth/me", headers=headers).json()["client"]
    assert profile["client_type"] == "INDIVIDUAL" and len(profile["inn"]) == 12
    created = client.post("/api/v1/applications", headers=headers, json={
        "product_type": "term_loan", "requested_amount": "1000000.00", "requested_term_months": 24,
    }).json()
    path = f"/api/v1/applications/{created['id']}"
    response = client.post(f"{path}/submit?version={created['version']}", headers=headers)
    assert response.status_code == 200
    approved = response.json()
    assert approved["status"] == "APPROVED"
    assert Decimal("550000") < Decimal(approved["approved_amount"]) < Decimal("650000")
    offer = approved["scoring_result"]["offer"]
    assert Decimal(offer["amount"]) == Decimal(approved["approved_amount"])
    assert Decimal(offer["dscr"]) >= Decimal("1.35")
    assert client.get(path, headers=headers).json()["scoring_result"] == approved["scoring_result"]
    assert client.post(f"{path}/sign?version={created['version']}", headers=headers).status_code == 409
    accepted = client.post(f"{path}/sign?version={approved['version']}", headers=headers)
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "ISSUED"
    assert accepted.json()["approved_amount"] == approved["approved_amount"]
    assert accepted.json()["scoring_result"]["offer"] == offer
    assert client.post(f"{path}/sign?version={accepted.json()['version']}", headers=headers).status_code == 409


def test_approval_without_terms_cannot_be_signed(client: TestClient) -> None:
    with TestSession() as db:
        _, profile = create_client_user(db)
        application = Application(client_id=profile.id, product_type="term_loan", status="APPROVED",
                                  requested_amount="1000000", requested_term_months=24, business_data={})
        db.add(application)
        db.commit()
        application_id = application.id
    headers = {"Authorization": f"Bearer {bearer_token(client)}"}
    response = client.post(f"/api/v1/applications/{application_id}/sign?version=1", headers=headers)
    assert response.status_code == 409
    assert client.get(f"/api/v1/applications/{application_id}", headers=headers).json()["status"] == "APPROVED"


def test_json_version_offer_contract_and_employee_history(client: TestClient) -> None:
    with TestSession() as db:
        seed_test_users(db, "local-test-password")
        db.commit()
    headers = {"Authorization": f"Bearer {bearer_token(client, 'demo.ip@example.com', 'local-test-password')}"}
    created = client.post("/api/v1/applications", headers=headers, json={
        "product_type": "term_loan", "requested_amount": "1000000.00", "requested_term_months": 24,
    }).json()
    path = f"/api/v1/applications/{created['id']}"
    assert client.post(f"{path}/submit", headers=headers).status_code == 422
    assert client.post(f"{path}/submit?version=2", headers=headers, json={"version": 1}).status_code == 422
    assert client.post(f"{path}/submit", headers=headers, json={"version": 0}).status_code == 422
    assert client.post(f"{path}/submit", headers=headers, json={"version": 1, "approved_amount": "9999999"}).status_code == 422
    approved_response = client.post(f"{path}/submit", headers=headers, json={"version": 1})
    assert approved_response.status_code == 200
    approved = approved_response.json()
    assert approved["offer"] == approved["scoring_result"]["offer"]
    employee_headers = {"Authorization": f"Bearer {bearer_token(client, 'test.employee1@example.com', 'local-test-password')}"}
    history = client.get("/api/v1/employee/applications?status=APPROVED", headers=employee_headers)
    assert history.status_code == 200 and approved["id"] in [item["id"] for item in history.json()]
    employee_card = client.get(f"/api/v1/employee/applications/{approved['id']}", headers=employee_headers)
    assert employee_card.json()["offer"] == approved["offer"]
    assert client.post(f"{path}/sign", headers=headers, json={"version": 1}).status_code == 409
    issued = client.post(f"{path}/sign", headers=headers, json={"version": approved["version"]})
    assert issued.status_code == 200 and issued.json()["offer"] == approved["offer"]
    history = client.get("/api/v1/employee/applications?status=ISSUED", headers=employee_headers)
    assert approved["id"] in [item["id"] for item in history.json()]


def test_retry_supports_json_version(client: TestClient) -> None:
    with TestSession() as db:
        seed_test_users(db, "local-test-password")
        db.commit()
    headers = {"Authorization": f"Bearer {bearer_token(client, 'test.client3@example.com', 'local-test-password')}"}
    created = client.post("/api/v1/applications", headers=headers, json=application_request()).json()
    submitted = client.post(f"/api/v1/applications/{created['id']}/submit", headers=headers, json={"version": 1}).json()
    assert submitted["decision_reason_code"] == "EXTERNAL_CHECK_UNAVAILABLE"
    employee_headers = {"Authorization": f"Bearer {bearer_token(client, 'test.employee1@example.com', 'local-test-password')}"}
    retry = client.post(f"/api/v1/employee/applications/{created['id']}/retry-checks", headers=employee_headers, json={"version": submitted["version"]})
    assert retry.status_code == 200 and retry.json()["status"] == "APPROVED"
    assert retry.json()["offer"] is not None


def test_openapi_describes_typed_offer_and_json_versions(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    assert "CreditOffer" in spec["components"]["schemas"]
    for path in ("/api/v1/applications/{id}/submit", "/api/v1/applications/{id}/sign", "/api/v1/employee/applications/{id}/retry-checks"):
        post = spec["paths"][path]["post"]
        assert "application/json" in post["requestBody"]["content"]
        version = next(param for param in post["parameters"] if param["name"] == "version")
        assert version["deprecated"] and not version["required"]
