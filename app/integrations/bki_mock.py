from dataclasses import dataclass

from app.integrations.fns_mock import CheckStatus


@dataclass(frozen=True)
class BKIResult:
    status: CheckStatus
    current_overdue_days: int | None
    monthly_debt_payments: str | None

    def as_response_data(self) -> dict[str, int | str | None]:
        return {
            "current_overdue_days": self.current_overdue_days,
            "monthly_debt_payments": self.monthly_debt_payments,
        }


def get_bki_result(inn: str) -> BKIResult:
    profiles = {
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
