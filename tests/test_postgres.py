"""Опциональная проверка PostgreSQL: только собственные временные схемы."""

import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.db.session import get_db
from app.main import app
from app.seed_test_users import seed_test_users
from app.services import application_service

pytestmark = pytest.mark.postgres


@pytest.fixture
def pg_client():
    address = os.getenv("CREDIT_TEST_POSTGRES_URL")
    if not address:
        pytest.skip("Для проверки PostgreSQL задайте CREDIT_TEST_POSTGRES_URL")
    url = make_url(address)
    assert url.get_backend_name() == "postgresql", "Требуется отдельная тестовая PostgreSQL"
    schema = f"credit_test_{uuid4().hex}"
    admin = create_engine(url)
    with admin.begin() as connection:
        connection.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
    isolated_url = url.update_query_dict({"options": f"-csearch_path={schema}"})
    engine = create_engine(isolated_url)
    try:
        env = {**os.environ, "DATABASE_URL": isolated_url.render_as_string(hide_password=False)}
        for command in (("upgrade", "head"), ("check",)):
            result = subprocess.run([sys.executable, "-m", "alembic", *command], cwd=Path(__file__).resolve().parents[1], env=env, capture_output=True, text=True, timeout=60)
            assert result.returncode == 0, result.stdout + result.stderr
        sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
        with sessions.begin() as db:
            seed_test_users(db, "postgres-test-password")

        def database():
            with sessions() as db:
                yield db

        app.dependency_overrides[get_db] = database
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()
        with admin.begin() as connection:
            connection.exec_driver_sql(f'DROP SCHEMA "{schema}" CASCADE')
        admin.dispose()


def login(client, email):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": "postgres-test-password"})
    assert response.status_code == 200
    data = response.json()
    return {"Authorization": f"Bearer {data['access_token']}"}, data["user"]["id"]


def submitted_application(client, headers):
    draft = client.post("/api/v1/applications", headers=headers, json={"product_type": "term_loan", "requested_amount": "1000000.00", "requested_term_months": 24})
    assert draft.status_code == 201
    draft = draft.json()
    response = client.post(f"/api/v1/applications/{draft['id']}/submit", headers=headers, json={"version": draft["version"]})
    assert response.status_code == 200
    return response.json()


def race_at_version_check(monkeypatch, application_id):
    original = application_service._check_version
    barrier = Barrier(2, timeout=10)

    def synchronized(application, expected_version):
        original(application, expected_version)
        if application.id == application_id:
            barrier.wait()

    monkeypatch.setattr(application_service, "_check_version", synchronized)


def test_postgres_concurrent_sign_issues_once(pg_client, monkeypatch):
    owner, _ = login(pg_client, "demo.ip@example.com")
    approved = submitted_application(pg_client, owner)
    assert approved["status"] == "APPROVED"
    path = f"/api/v1/applications/{approved['id']}"
    race_at_version_check(monkeypatch, approved["id"])
    with ThreadPoolExecutor(max_workers=2) as executor:
        requests = [executor.submit(pg_client.post, f"{path}/sign", headers=owner, json={"version": approved["version"]}) for _ in range(2)]
        results = [request.result(timeout=20) for request in requests]
    assert sorted(response.status_code for response in results) == [200, 409]
    issued = pg_client.get(path, headers=owner).json()
    assert issued["status"] == "ISSUED" and issued["version"] == approved["version"] + 1
    assert len(issued["status_history"]) == len(approved["status_history"]) + 1
    assert sum(event["new_status"] == "ISSUED" for event in issued["status_history"]) == 1
    assert issued["offer"] == approved["offer"]


def test_postgres_concurrent_employee_decisions_have_one_winner(pg_client, monkeypatch):
    owner, _ = login(pg_client, "demo.review@example.com")
    employee_one, first_id = login(pg_client, "test.employee1@example.com")
    employee_two, second_id = login(pg_client, "test.employee2@example.com")
    review = submitted_application(pg_client, owner)
    assert review["status"] == "MANUAL_REVIEW"
    path = f"/api/v1/employee/applications/{review['id']}"
    payload = {"version": review["version"], "comment": "Проверены данные"}
    race_at_version_check(monkeypatch, review["id"])
    with ThreadPoolExecutor(max_workers=2) as executor:
        approve = executor.submit(pg_client.post, f"{path}/action", headers=employee_one, json={**payload, "action": "APPROVE", "approved_amount": "1000000.00"})
        reject = executor.submit(pg_client.post, f"{path}/action", headers=employee_two, json={**payload, "action": "REJECT", "decision_reason_code": "EMPLOYEE_RISK_DECLINED"})
        results = [approve.result(timeout=20), reject.result(timeout=20)]
    assert sorted(response.status_code for response in results) == [200, 409]
    current = pg_client.get(path, headers=employee_one).json()
    assert current["version"] == review["version"] + 1
    assert len(current["status_history"]) == len(review["status_history"]) + 1
    expected = ("APPROVED", first_id) if results[0].status_code == 200 else ("REJECTED", second_id)
    assert (current["status"], current["status_history"][-1]["changed_by_user_id"]) == expected
