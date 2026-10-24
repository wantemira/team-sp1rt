from dataclasses import dataclass
from typing import Literal


CheckStatus = Literal["SUCCESS", "TIMEOUT", "ERROR"]
CLIENT_3_INN = "7700000003"


@dataclass(frozen=True)
class FNSResult:
    status: CheckStatus
    is_active: bool | None
    business_age_months: int | None

    def as_response_data(self) -> dict[str, bool | int | None]:
        return {
            "is_active": self.is_active,
            "business_age_months": self.business_age_months,
        }


def get_fns_result(inn: str, attempt_number: int) -> FNSResult:
    if inn == CLIENT_3_INN and attempt_number == 1:
        return FNSResult(status="TIMEOUT", is_active=None, business_age_months=None)

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
