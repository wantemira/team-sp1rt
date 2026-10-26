from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.core.credit_policy import LoanTerm


class ProductResponse(BaseModel):
    id: Literal["term_loan"]
    name: str
    min_amount: Decimal
    max_amount: Decimal
    terms: list[LoanTerm]
    disbursement_count: Literal[1] = 1
    term_type: Literal["fixed"] = "fixed"
    repayment_type: Literal["annuity"] = "annuity"
