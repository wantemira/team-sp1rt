"""Единые ограничения демонстрационного продукта для HTTP и расчётов."""

from decimal import Decimal
from typing import Literal, get_args

PRODUCT_ID = "term_loan"
PRODUCT_NAME = "Кредит на оборотные средства"
MIN_AMOUNT = Decimal("100000.00")
MAX_AMOUNT = Decimal("5000000.00")
LoanTerm = Literal[6, 12, 24]
TERMS = get_args(LoanTerm)
TARGET_DSCR = Decimal("1.35")
