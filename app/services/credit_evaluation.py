from dataclasses import dataclass
from typing import Literal

from app.integrations.bki_mock import BKIResult
from app.integrations.fns_mock import FNSResult
from app.models import Application

CreditStatus = Literal["NEEDS_INFO", "MANUAL_REVIEW", "APPROVED", "REJECTED"]

REJECT_SCORE_MAX = 39
APPROVE_SCORE_MIN = 90


@dataclass(frozen=True)
class CreditEvaluation:
    status: CreditStatus
    score: int | None
    reason_code: str


def evaluate_credit(
    application: Application,
    fns_result: FNSResult,
    bki_result: BKIResult,
) -> CreditEvaluation:
    """MVP scoring placeholder; replace its score calculation with the future scorer."""
    financials = application.business_data.get("financials") or {}
    if not financials:
        return CreditEvaluation(
            status="NEEDS_INFO",
            score=None,
            reason_code="MISSING_FINANCIAL_INFORMATION",
        )

    if fns_result.status != "SUCCESS" or bki_result.status != "SUCCESS":
        return CreditEvaluation(
            status="MANUAL_REVIEW",
            score=None,
            reason_code="EXTERNAL_CHECK_UNAVAILABLE",
        )

    score = _demo_score(fns_result, bki_result)
    return CreditEvaluation(
        status=status_for_score(score),
        score=score,
        reason_code=_reason_for_score(score),
    )


def _demo_score(fns_result: FNSResult, bki_result: BKIResult) -> int:
    if (
        fns_result.is_active is not True
        or fns_result.business_age_months is None
        or fns_result.business_age_months < 12
        or bki_result.current_overdue_days is None
        or bki_result.current_overdue_days > 0
    ):
        return 20
    return 95


def status_for_score(score: int) -> CreditStatus:
    if not 0 <= score <= 100:
        raise ValueError("Credit score must be between 0 and 100.")
    if score <= REJECT_SCORE_MAX:
        return "REJECTED"
    if score >= APPROVE_SCORE_MIN:
        return "APPROVED"
    return "MANUAL_REVIEW"


def _reason_for_score(score: int) -> str:
    if score <= REJECT_SCORE_MAX:
        return "SCORE_BELOW_APPROVAL_THRESHOLD"
    if score >= APPROVE_SCORE_MIN:
        return "SCORE_MEETS_APPROVAL_THRESHOLD"
    return "SCORE_REQUIRES_MANUAL_REVIEW"
