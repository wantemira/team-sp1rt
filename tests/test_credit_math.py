from dataclasses import replace
from decimal import Decimal as D

import pytest

from app.services.credit_math import (
    CreditInputs, TARGET_DSCR, affordable_loan, annual_rate,
    monthly_payment, price_loan, principal_for_payment, score_and_pd,
)


@pytest.fixture
def business():
    return CreditInputs(1500, "47.11", D("6000000"), D("4800000"), D("43000"), 24, 0)


def test_annuity_matches_reference_and_inverse():
    payment = monthly_payment(D("1000000"), D(20), 24)
    assert payment.quantize(D("0.01")) == D("50895.80")
    assert abs(principal_for_payment(payment, D(20), 24) - D("1000000")) < D("0.000001")
    assert monthly_payment(D(120000), D(0), 12) == 10000


def test_weight_normalization_and_pd_direction():
    worst, worst_pd = score_and_pd((D(0),) * 5)
    best, best_pd = score_and_pd((D(1),) * 5)
    assert worst == 0 and best == 100 and best_pd < worst_pd


def test_counter_offer_is_maximal_safe_and_uses_final_rate(business):
    offer = affordable_loan(business, D("1000000"), 24)
    assert offer is not None
    assert D("550000") < offer.amount < D("650000")
    assert offer.dscr >= TARGET_DSCR
    assert price_loan(business, offer.amount + 1, 24).dscr < TARGET_DSCR
    assert abs(offer.annual_rate_pct - annual_rate(offer.pd)) < D("0.0002")
    assert affordable_loan(business, D("1000000"), 24) == offer


def test_full_approval_does_not_increase_requested_amount(business):
    offer = affordable_loan(replace(business, annual_expenses=D("3000000")), D("1000000.50"), 24)
    assert offer.amount == D("1000000.50")
    assert offer.dscr >= TARGET_DSCR


@pytest.mark.parametrize("expenses,debt", [(D("6000000"), D(0)), (D("6500000"), D(0)), (D("4500000"), D("90000"))])
def test_no_offer_when_cashflow_cannot_cover_minimum(business, expenses, debt):
    assert affordable_loan(replace(business, annual_expenses=expenses, monthly_debt_payments=debt), D("1000000"), 24) is None


def test_no_history_zero_revenue_and_new_business_are_defined(business):
    unknown = replace(business, days_in_business=0, total_payments_12m=0)
    loan = price_loan(unknown, D("100000"), 12)
    assert loan.factors[0] == 0 and loan.factors[2] == D("0.5")
    assert affordable_loan(replace(business, annual_revenue=D(0)), D("100000"), 12) is None


def test_worse_payment_history_never_improves_price(business):
    good = price_loan(business, D("600000"), 24)
    bad = price_loan(replace(business, delayed_payments_12m=4), D("600000"), 24)
    assert bad.score <= good.score and bad.annual_rate_pct >= good.annual_rate_pct


@pytest.mark.parametrize("changes", [
    {"days_in_business": -1}, {"monthly_debt_payments": D(-1)},
    {"annual_revenue": D("NaN")}, {"delayed_payments_12m": 25},
])
def test_invalid_inputs_are_rejected(business, changes):
    with pytest.raises(ValueError):
        replace(business, **changes)
