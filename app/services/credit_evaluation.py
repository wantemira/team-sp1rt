from dataclasses import dataclass, field
from typing import Any, Literal

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
    scoring_result: dict[str, Any] = field(default_factory=dict)


def evaluate_credit(
    application: Application,
    fns_result: FNSResult,
    bki_result: BKIResult,
) -> CreditEvaluation:
    """MVP scoring placeholder; replace its score calculation with the future scorer."""
    financials = application.business_data.get("financials") or {}
    if not financials:
        reason_code = "MISSING_FINANCIAL_INFORMATION"
        return CreditEvaluation(
            status="NEEDS_INFO",
            score=None,
            reason_code=reason_code,
            scoring_result=_scoring_result(
                status="NEEDS_INFO",
                score=None,
                reason_code=reason_code,
                financials=financials,
                fns_result=fns_result,
                bki_result=bki_result,
                decision_factors={"financial_information_present": False},
            ),
        )

    if fns_result.status != "SUCCESS" or bki_result.status != "SUCCESS":
        reason_code = "EXTERNAL_CHECK_UNAVAILABLE"
        return CreditEvaluation(
            status="MANUAL_REVIEW",
            score=None,
            reason_code=reason_code,
            scoring_result=_scoring_result(
                status="MANUAL_REVIEW",
                score=None,
                reason_code=reason_code,
                financials=financials,
                fns_result=fns_result,
                bki_result=bki_result,
                decision_factors={"external_checks_succeeded": False},
            ),
        )

    score = _demo_score(fns_result, bki_result)
    status = status_for_score(score)
    reason_code = _reason_for_score(score)
    return CreditEvaluation(
        status=status,
        score=score,
        reason_code=reason_code,
        scoring_result=_scoring_result(
            status=status,
            score=score,
            reason_code=reason_code,
            financials=financials,
            fns_result=fns_result,
            bki_result=bki_result,
            decision_factors={
                "business_is_active": fns_result.is_active is True,
                "business_age_months": fns_result.business_age_months,
                "minimum_business_age_months": 12,
                "current_overdue_days": bki_result.current_overdue_days,
                "overdue_is_stop_factor": (
                    bki_result.current_overdue_days is not None
                    and bki_result.current_overdue_days > 0
                ),
                "reject_score_max": REJECT_SCORE_MAX,
                "approve_score_min": APPROVE_SCORE_MIN,
            },
        ),
    )


def _scoring_result(
    *,
    status: CreditStatus,
    score: int | None,
    reason_code: str,
    financials: dict[str, Any],
    fns_result: FNSResult,
    bki_result: BKIResult,
    decision_factors: dict[str, Any],
) -> dict[str, Any]:
    return {
        "model": "mvp_demo_thresholds_v1",
        "status": status,
        "score": score,
        "reason_code": reason_code,
        "inputs": {
            "financials": financials,
            "fns": {
                "status": fns_result.status,
                **fns_result.as_response_data(),
            },
            "bki": {
                "status": bki_result.status,
                **bki_result.as_response_data(),
            },
        },
        "decision_factors": decision_factors,
    }


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
