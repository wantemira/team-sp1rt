"""Adapt source responses to the pure calculation and choose a workflow outcome."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Literal

from app.integrations.bki_mock import BKIResult
from app.integrations.fns_mock import FNSResult
from app.models import Application
from app.services.credit_math import (
    CreditInputs, RULES_VERSION, TARGET_DSCR, affordable_loan, explanation, price_loan,
)

CreditStatus = Literal["NEEDS_INFO", "MANUAL_REVIEW", "APPROVED", "REJECTED"]
REJECT_SCORE_MAX = 39
APPROVE_SCORE_MIN = 65


@dataclass(frozen=True)
class CreditEvaluation:
    status: CreditStatus
    score: int | None
    reason_code: str
    scoring_result: dict[str, Any] = field(default_factory=dict)
    approved_amount: Decimal | None = None
    approved_rate: Decimal | None = None
    risk_grade: str | None = None
    missing_fields: tuple[str, ...] = ()


def evaluate_credit(
    application: Application, fns_result: FNSResult, bki_result: BKIResult,
    *, calculated_at: datetime | None = None,
) -> CreditEvaluation:
    calculated_at = calculated_at or datetime.now(timezone.utc)
    financials = application.business_data.get("financials") or {}
    inputs = {
        "financials": financials,
        "fns": {"status": fns_result.status, **fns_result.as_response_data()},
        "bki": {"status": bki_result.status, **bki_result.as_response_data()},
    }

    def result(status, reason, *, loan=None, offer=None, missing=()):
        score = int(loan.score.quantize(Decimal(1), rounding=ROUND_HALF_UP)) if loan else None
        grade = ("A" if loan.score >= 85 else "B" if loan.score >= 65 else "C" if loan.score >= 40 else "D") if loan else None
        return CreditEvaluation(
            status, score, reason,
            {"model": RULES_VERSION, "rules_version": RULES_VERSION,
             "calculated_at": calculated_at.isoformat(), "status": status,
             "reason_code": reason, "score": score, "inputs": inputs,
             "pd": str(loan.pd) if loan else None,
             "factors": explanation(loan) if loan else [], "offer": offer},
            loan.amount.quantize(Decimal("0.01")) if offer else None,
            loan.annual_rate_pct if offer else None,
            grade, tuple(missing),
        )

    # Missing data and a technical failure are not evidence of default.
    if fns_result.status != "SUCCESS" or bki_result.status != "SUCCESS":
        return result("MANUAL_REVIEW", "EXTERNAL_CHECK_UNAVAILABLE")
    if fns_result.is_active is None or fns_result.business_age_months is None or bki_result.current_overdue_days is None:
        return result("MANUAL_REVIEW", "EXTERNAL_DATA_INCOMPLETE")
    if not fns_result.is_active:
        return result("REJECTED", "BUSINESS_INACTIVE")
    days = ((calculated_at.date() - fns_result.registration_date).days
            if fns_result.registration_date else fns_result.business_age_months * 30)
    if days < 0:
        return result("MANUAL_REVIEW", "INVALID_SOURCE_DATA")
    if (days < 365 if fns_result.registration_date else fns_result.business_age_months < 12):
        return result("REJECTED", "BUSINESS_TOO_YOUNG")
    if bki_result.current_overdue_days > 0:
        return result("REJECTED", "CURRENT_OVERDUE")

    # Synthetic source values take priority over user-provided financials.
    revenue = fns_result.annual_revenue if fns_result.annual_revenue is not None else financials.get("annual_revenue")
    expenses = fns_result.annual_operating_expenses if fns_result.annual_operating_expenses is not None else financials.get("annual_expenses")
    missing = [f"business_data.financials.{key}" for key, value in
               (("annual_revenue", revenue), ("annual_expenses", expenses)) if value is None]
    if missing:
        return result("NEEDS_INFO", "MISSING_FINANCIAL_INFORMATION", missing=missing)
    if bki_result.monthly_debt_payments is None:
        return result("MANUAL_REVIEW", "EXTERNAL_DATA_INCOMPLETE")
    try:
        business = CreditInputs(days, fns_result.okved, Decimal(revenue), Decimal(expenses),
                                Decimal(bki_result.monthly_debt_payments),
                                bki_result.total_payments_12m, bki_result.delayed_payments_12m)
    except (ValueError, TypeError, InvalidOperation):
        return result("MANUAL_REVIEW", "INVALID_SOURCE_DATA")
    if business.monthly_cash_flow <= 0:
        return result("REJECTED", "NON_POSITIVE_CASH_FLOW")
    loan = affordable_loan(business, application.requested_amount, application.requested_term_months)
    if loan is None:
        return result("REJECTED", "NO_AFFORDABLE_PRODUCT_AMOUNT")
    # Decisions use unrounded scores so display rounding cannot cross a threshold.
    if loan.score < 40:
        return result("REJECTED", "SCORE_BELOW_APPROVAL_THRESHOLD", loan=loan)
    if loan.score < APPROVE_SCORE_MIN:
        return result("MANUAL_REVIEW", "SCORE_REQUIRES_MANUAL_REVIEW", loan=loan)
    counter = loan.amount < application.requested_amount
    requested = price_loan(business, application.requested_amount, application.requested_term_months)
    money = lambda value: str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    offer = {
        "kind": "COUNTER_OFFER" if counter else "ORIGINAL",
        "amount": money(loan.amount), "annual_rate_pct": str(loan.annual_rate_pct),
        "term_months": application.requested_term_months,
        "monthly_payment": money(loan.monthly_payment),
        "dscr": str(loan.dscr), "requested_dscr": str(requested.dscr),
        "target_dscr": str(TARGET_DSCR),
        "monthly_cash_flow": money(business.monthly_cash_flow),
        "existing_debt_payments": money(business.monthly_debt_payments),
        "max_total_debt_service": money(business.monthly_cash_flow / TARGET_DSCR),
        "explanation": (
            "Уменьшили сумму, чтобы денежный поток покрывал все кредитные платежи минимум в 1,35 раза."
            if counter else "Денежный поток позволяет обслуживать запрошенную сумму с запасом."
        ),
    }
    return result("APPROVED", "AFFORDABLE_COUNTER_OFFER" if counter else "AFFORDABLE_REQUEST", loan=loan, offer=offer)


def status_for_score(score: int) -> CreditStatus:
    if not 0 <= score <= 100:
        raise ValueError("Credit score must be between 0 and 100.")
    if score <= REJECT_SCORE_MAX:
        return "REJECTED"
    return "APPROVED" if score >= APPROVE_SCORE_MIN else "MANUAL_REVIEW"
