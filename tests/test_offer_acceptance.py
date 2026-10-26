from contextlib import contextmanager

import pytest

from app.db.session import get_db
from app.main import app
from app.models import Application


@pytest.mark.parametrize("changes", [
    {"amount": "500000.00"},
    {"annual_rate_pct": "1.00"},
    {"term_months": 12},
    {"kind": "ORIGINAL"},
    {"monthly_payment": None},
    {"dscr": "1.10"},
    {"target_dscr": "2.00"},
])
def test_inconsistent_saved_offer_cannot_be_issued(auth_client, changes):
    token = auth_client.post("/api/v1/auth/login", json={"email": "demo.ip@example.com", "password": "passw"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    draft = auth_client.post("/api/v1/applications", headers=headers, json={"product_type": "term_loan", "requested_amount": "1000000.00", "requested_term_months": 24}).json()
    path = f"/api/v1/applications/{draft['id']}"
    assert auth_client.post(f"{path}/submit", headers=headers, json={"version": draft["version"]}).json()["status"] == "APPROVED"
    # Имитируем несогласованную старую запись, а не новый расчёт скоринга.
    session = contextmanager(app.dependency_overrides[get_db])
    with session() as db:
        saved = db.get(Application, draft["id"])
        saved.scoring_result = {**saved.scoring_result, "offer": {**saved.offer, **changes}}
        db.commit()
        version = saved.version
        history_size = len(saved.status_history)
    rejected = auth_client.post(f"{path}/sign", headers=headers, json={"version": version})
    assert rejected.status_code == 409 and rejected.json()["error_code"] == "OFFER_INCONSISTENT"
    with session() as db:
        current = db.get(Application, draft["id"])
        assert (current.status, current.version, current.signed_at, current.issued_at) == ("APPROVED", version, None, None)
        assert len(current.status_history) == history_size
