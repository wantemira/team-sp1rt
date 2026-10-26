"""Демонстрационный расчёт без обращений к БД и внешним системам.

Деньги — Decimal в рублях, ставка — проценты годовых: 20 означает 20%.
PD — демонстрационное преобразование балла без калибровки на дефолтах.
"""

from dataclasses import dataclass
from decimal import Decimal, ROUND_CEILING, ROUND_DOWN, ROUND_HALF_UP
from math import exp, log10

from app.core.credit_policy import MAX_AMOUNT, MIN_AMOUNT, TARGET_DSCR, TERMS

D = Decimal
RULES_VERSION = "cash-flow-demo-v1"
WEIGHTS = (15, 25, 20, 15, 10)
FACTOR_LABELS = (
    ("AGE", "Возраст бизнеса"),
    ("DSCR", "Покрытие долговых платежей"),
    ("DISCIPLINE", "Кредитная дисциплина"),
    ("SIZE", "Сумма относительно выручки"),
    ("INDUSTRY", "Отраслевой риск"),
)


@dataclass(frozen=True)
class CreditInputs:
    days_in_business: int
    okved: str
    annual_revenue: Decimal
    annual_expenses: Decimal
    monthly_debt_payments: Decimal
    total_payments_12m: int
    delayed_payments_12m: int

    def __post_init__(self) -> None:
        values = (self.annual_revenue, self.annual_expenses, self.monthly_debt_payments)
        if any(not v.is_finite() or v < 0 for v in values):
            raise ValueError("Financial inputs must be finite and non-negative.")
        if self.days_in_business < 0:
            raise ValueError("Registration date cannot be in the future.")
        if not 0 <= self.delayed_payments_12m <= self.total_payments_12m:
            raise ValueError("Invalid payment history counts.")

    @property
    def monthly_cash_flow(self) -> Decimal:
        return (self.annual_revenue - self.annual_expenses) / 12


@dataclass(frozen=True)
class PricedLoan:
    amount: Decimal
    annual_rate_pct: Decimal
    monthly_payment: Decimal
    dscr: Decimal
    score: Decimal
    pd: Decimal
    factors: tuple[Decimal, ...]


def monthly_payment(amount: Decimal, annual_rate_pct: Decimal, months: int) -> Decimal:
    """Аннуитет без округления; округляется только платёж итогового предложения."""
    if (not amount.is_finite() or not annual_rate_pct.is_finite()
            or amount < 0 or annual_rate_pct < 0 or months <= 0):
        raise ValueError("Invalid loan parameters.")
    r = annual_rate_pct / 100 / 12
    if r == 0:
        return amount / months
    growth = (1 + r) ** months
    return amount * r * growth / (growth - 1)


def principal_for_payment(payment: Decimal, annual_rate_pct: Decimal, months: int) -> Decimal:
    return payment / monthly_payment(D(1), annual_rate_pct, months)


def _clamp(value: Decimal) -> Decimal:
    return max(D(0), min(D(1), value))


def score_factors(inputs: CreditInputs, amount: Decimal, dscr: Decimal) -> tuple[Decimal, ...]:
    age = D(str(log10(max(1, inputs.days_in_business)))) / 3
    coverage = (dscr - 1) * 2
    # При отсутствии истории используем нейтральный фактор дисциплины.
    discipline = (D("0.5") if inputs.total_payments_12m == 0 else
                  1 - D(inputs.delayed_payments_12m) / inputs.total_payments_12m * 5)
    ratio = amount / inputs.annual_revenue if inputs.annual_revenue else D("Infinity")
    size = (D(1) if ratio <= D("0.2") else
            1 - (ratio - D("0.2")) * D(5) / 3 if ratio <= D("0.5") else
            D("0.5") - (ratio - D("0.5")) * 2)
    risk = {"62": "0.2", "63": "0.2", "46": "0.5", "47": "0.5",
            "55": "0.8", "56": "0.8"}.get(inputs.okved.split(".")[0], "0.5")
    return tuple(_clamp(v) for v in (age, coverage, discipline, size, 1 - D(risk)))


def score_and_pd(factors: tuple[Decimal, ...]) -> tuple[Decimal, Decimal]:
    score = sum(w * f for w, f in zip(WEIGHTS, factors, strict=True)) * 100 / sum(WEIGHTS)
    pd = D(str(1 / (1 + exp(float((score - 50) / 10)))))
    return score, pd


def annual_rate(pd: Decimal) -> Decimal:
    # 15% база + PD × 45% потери × 12% стоимость капитала + 2% расходы + 3% маржа.
    return D(20) + pd * D("5.4")


def price_loan(inputs: CreditInputs, amount: Decimal, months: int) -> PricedLoan:
    """Совместный расчёт ставки, платежа, DSCR и риска методом бисекции.

    Ставка ищется в диапазоне 20–25,4%; баллы до выбора условий не округляются.
    """
    low, high = D(20), D("25.4")
    for _ in range(48):
        rate = (low + high) / 2
        service = inputs.monthly_debt_payments + monthly_payment(amount, rate, months)
        dscr = inputs.monthly_cash_flow / service if service else D(0)
        _, pd = score_and_pd(score_factors(inputs, amount, dscr))
        if annual_rate(pd) > rate:
            low = rate
        else:
            high = rate
    rate = high.quantize(D("0.0001"), rounding=ROUND_CEILING)
    payment = monthly_payment(amount, rate, months).quantize(D("0.01"), rounding=ROUND_CEILING)
    service = inputs.monthly_debt_payments + payment
    dscr = inputs.monthly_cash_flow / service if service else D(0)
    factors = score_factors(inputs, amount, dscr)
    score, pd = score_and_pd(factors)
    return PricedLoan(amount, rate, payment, dscr, score, pd, factors)


def affordable_loan(inputs: CreditInputs, requested: Decimal, months: int) -> PricedLoan | None:
    """Полный запрос или уменьшенная сумма в целых рублях с допустимым итоговым DSCR."""
    if not requested.is_finite() or not MIN_AMOUNT <= requested <= MAX_AMOUNT or months not in TERMS:
        raise ValueError("Loan is outside product limits.")
    if inputs.monthly_cash_flow <= 0:
        return None
    full = price_loan(inputs, requested, months)
    if full.dscr >= TARGET_DSCR:
        return full
    minimum = price_loan(inputs, MIN_AMOUNT, months)
    if minimum.dscr < TARGET_DSCR:
        return None
    low, high = MIN_AMOUNT, requested
    while high - low > 1:
        middle = ((low + high) / 2).quantize(D(1), rounding=ROUND_DOWN)
        if price_loan(inputs, middle, months).dscr >= TARGET_DSCR:
            low = middle
        else:
            high = middle
    return price_loan(inputs, low, months)


def explanation(loan: PricedLoan) -> list[dict]:
    return [
        {"code": code, "label": label,
         "points": str((factor * weight * 100 / sum(WEIGHTS)).quantize(D("0.01"), rounding=ROUND_HALF_UP)),
         "explanation": f"{(factor * 100).quantize(D('0.1'))}% от максимального вклада фактора"}
        for (code, label), weight, factor in zip(FACTOR_LABELS, WEIGHTS, loan.factors, strict=True)
    ]
