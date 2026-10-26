import pytest

from app.services.credit_evaluation import status_for_score


@pytest.mark.parametrize(
    ("score", "status"),
    [
        (0, "REJECTED"),
        (39, "REJECTED"),
        (40, "MANUAL_REVIEW"),
        (64, "MANUAL_REVIEW"),
        (65, "APPROVED"),
        (90, "APPROVED"),
        (100, "APPROVED"),
    ],
)
def test_score_thresholds(score: int, status: str) -> None:
    assert status_for_score(score) == status


@pytest.mark.parametrize("score", [-1, 101])
def test_score_outside_range_is_rejected(score: int) -> None:
    with pytest.raises(ValueError, match="between 0 and 100"):
        status_for_score(score)


from dataclasses import replace
from datetime import datetime, timezone
from decimal import Decimal

from app.integrations.bki_mock import get_bki_result
from app.integrations.fns_mock import DEMO_IP_INN, get_fns_result
from app.models import Application
from app.services.credit_evaluation import evaluate_credit


@pytest.fixture
def demo_inputs():
    return (
        Application(requested_amount=Decimal("1000000"), requested_term_months=24, business_data={}),
        get_fns_result(DEMO_IP_INN, 1), get_bki_result(DEMO_IP_INN),
    )


def test_demo_counter_offer_is_explained_and_reproducible(demo_inputs):
    calculated_at = datetime(2026, 10, 26, tzinfo=timezone.utc)
    result = evaluate_credit(*demo_inputs, calculated_at=calculated_at)
    assert result == evaluate_credit(*demo_inputs, calculated_at=calculated_at)
    assert result.status == "APPROVED"
    assert result.reason_code == "AFFORDABLE_COUNTER_OFFER"
    assert Decimal("550000") < result.approved_amount < Decimal("650000")
    offer = result.scoring_result["offer"]
    assert Decimal(offer["dscr"]) >= Decimal("1.35")
    assert len(result.scoring_result["factors"]) == 5
    assert result.approved_rate == Decimal(offer["annual_rate_pct"])


def test_user_financials_cannot_override_synthetic_source(demo_inputs):
    application, fns, bki = demo_inputs
    original = evaluate_credit(application, fns, bki)
    application.business_data = {"financials": {"annual_revenue": "999999999999.00", "annual_expenses": "0.00"}}
    spoofed = evaluate_credit(application, fns, bki)
    assert spoofed.approved_amount == original.approved_amount
    assert spoofed.approved_rate == original.approved_rate


@pytest.mark.parametrize("fns_changes,expected_status,expected_reason", [
    ({"status": "TIMEOUT"}, "MANUAL_REVIEW", "EXTERNAL_CHECK_UNAVAILABLE"),
    ({"is_active": False}, "REJECTED", "BUSINESS_INACTIVE"),
    ({"annual_revenue": "0.00"}, "REJECTED", "NON_POSITIVE_CASH_FLOW"),
    ({"annual_operating_expenses": "5999999.00"}, "REJECTED", "NO_AFFORDABLE_PRODUCT_AMOUNT"),
    ({"annual_revenue": None}, "NEEDS_INFO", "MISSING_FINANCIAL_INFORMATION"),
])
def test_outcomes_distinguish_technical_missing_and_negative_data(demo_inputs, fns_changes, expected_status, expected_reason):
    application, fns, bki = demo_inputs
    result = evaluate_credit(application, replace(fns, **fns_changes), bki)
    assert (result.status, result.reason_code) == (expected_status, expected_reason)
    assert result.approved_amount is None
    assert result.scoring_result["offer"] is None


@pytest.mark.parametrize("source,changes", [
    ("fns", {"is_active": "false"}),
    ("fns", {"business_age_months": "48"}),
    ("fns", {"registration_date": "2022-01-01"}),
    ("fns", {"okved": ["47.11"]}),
    ("fns", {"annual_revenue": "NaN"}),
    ("fns", {"annual_operating_expenses": "-1"}),
    ("bki", {"current_overdue_days": False}),
    ("bki", {"total_payments_12m": "24"}),
    ("bki", {"delayed_payments_12m": 25}),
    ("bki", {"monthly_debt_payments": 0.0}),
])
def test_malformed_source_data_cannot_approve_or_crash(demo_inputs, source, changes):
    application, fns, bki = demo_inputs
    fns = replace(fns, **changes) if source == "fns" else fns
    bki = replace(bki, **changes) if source == "bki" else bki
    result = evaluate_credit(application, fns, bki)
    assert (result.status, result.reason_code) == ("MANUAL_REVIEW", "INVALID_SOURCE_DATA")
    assert result.approved_amount is None and result.scoring_result["offer"] is None


def test_registration_date_is_enough_without_legacy_business_age(demo_inputs):
    application, fns, bki = demo_inputs
    result = evaluate_credit(application, replace(fns, business_age_months=None), bki)
    assert result.status == "APPROVED"
