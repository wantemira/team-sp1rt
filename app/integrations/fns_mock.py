from dataclasses import dataclass
from datetime import date
from typing import Literal


CheckStatus = Literal["SUCCESS", "TIMEOUT", "ERROR"]
CLIENT_3_INN = "7700000003"
DEMO_IP_INN = "770000000001"


@dataclass(frozen=True)
class FNSResult:
    status: CheckStatus
    is_active: bool | None
    business_age_months: int | None
    registration_date: date | None = None
    okved: str | None = "47.11"
    annual_revenue: str | None = None
    annual_operating_expenses: str | None = "3000000.00"

    def as_response_data(self) -> dict:
        return {
            "is_active": self.is_active,
            "business_age_months": self.business_age_months,
            "registration_date": self.registration_date.isoformat() if isinstance(self.registration_date, date) else self.registration_date,
            "okved": self.okved,
            "annual_revenue": self.annual_revenue,
            "annual_operating_expenses": self.annual_operating_expenses,
        }


def get_fns_result(inn: str, attempt_number: int) -> FNSResult:
    if inn == DEMO_IP_INN:
        return FNSResult(
            "SUCCESS", True, 48, date(2022, 1, 1), "47.11", "6000000.00", "4800000.00"
        )
    if inn == CLIENT_3_INN and attempt_number == 1:
        return FNSResult(status="TIMEOUT", is_active=None, business_age_months=None,
                         annual_operating_expenses=None)

    profiles = {
        "7700000001": (True, 36),
        "7700000002": (True, 6),
        CLIENT_3_INN: (True, 36),
    }
    is_active, business_age_months = profiles.get(inn, (True, 36))
    return FNSResult(
        status="SUCCESS",
        is_active=is_active,
        business_age_months=business_age_months,
    )
