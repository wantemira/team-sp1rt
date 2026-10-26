from dataclasses import dataclass

from app.integrations.fns_mock import CheckStatus, DEMO_IP_INN


@dataclass(frozen=True)
class BKIResult:
    status: CheckStatus
    current_overdue_days: int | None
    monthly_debt_payments: str | None
    total_payments_12m: int | None = 24
    delayed_payments_12m: int | None = 0
    active_loans_count: int | None = 1
    credit_limit_total: str | None = "2000000.00"

    def as_response_data(self) -> dict:
        return {
            "current_overdue_days": self.current_overdue_days,
            "monthly_debt_payments": self.monthly_debt_payments,
            "total_payments_12m": self.total_payments_12m,
            "delayed_payments_12m": self.delayed_payments_12m,
            "active_loans_count": self.active_loans_count,
            "credit_limit_total": self.credit_limit_total,
        }


def get_bki_result(inn: str) -> BKIResult:
    profiles = {
        DEMO_IP_INN: (0, "43000.00"),
        "7700000001": (0, "50000.00"),
        "7700000002": (10, "0.00"),
        "7700000003": (0, "50000.00"),
    }
    current_overdue_days, monthly_debt_payments = profiles.get(
        inn, (0, "0.00")
    )
    return BKIResult(
        status="SUCCESS",
        current_overdue_days=current_overdue_days,
        monthly_debt_payments=monthly_debt_payments,
    )
