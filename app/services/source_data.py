"""Проверка данных источников до расчёта и восстановление сохранённых ответов."""

import re
from datetime import date
from decimal import Decimal, InvalidOperation

from app.integrations.bki_mock import BKIResult
from app.integrations.fns_mock import FNSResult


def source_problem(fns: FNSResult, bki: BKIResult, on: date) -> str | None:
    if fns.status != "SUCCESS" or bki.status != "SUCCESS":
        return "EXTERNAL_CHECK_UNAVAILABLE"
    required = (fns.is_active, bki.current_overdue_days, bki.monthly_debt_payments,
                bki.total_payments_12m, bki.delayed_payments_12m, fns.okved)
    if any(value is None or value == "" for value in required) or (fns.registration_date is None and fns.business_age_months is None):
        return "EXTERNAL_DATA_INCOMPLETE"
    counts = (fns.business_age_months, bki.current_overdue_days,
              bki.total_payments_12m, bki.delayed_payments_12m)
    if type(fns.is_active) is not bool or any(value is not None and (type(value) is not int or value < 0) for value in counts):
        return "INVALID_SOURCE_DATA"
    if fns.registration_date is not None and (type(fns.registration_date) is not date or fns.registration_date > on):
        return "INVALID_SOURCE_DATA"
    if not isinstance(fns.okved, str) or not re.fullmatch(r"\d{2}(?:\.\d{1,2}){0,2}", fns.okved):
        return "INVALID_SOURCE_DATA"
    if bki.delayed_payments_12m > bki.total_payments_12m:
        return "INVALID_SOURCE_DATA"
    for value in (fns.annual_revenue, fns.annual_operating_expenses, bki.monthly_debt_payments):
        if value is None:
            continue  # Выручку и расходы можно запросить у клиента.
        try:
            if not isinstance(value, str):
                return "INVALID_SOURCE_DATA"
            amount = Decimal(value)
            if not amount.is_finite() or amount < 0 or amount >= Decimal("1e16") or amount != amount.quantize(Decimal("0.01")):
                return "INVALID_SOURCE_DATA"
        except InvalidOperation:
            return "INVALID_SOURCE_DATA"
    return None


def business_days(fns: FNSResult, on: date) -> int:
    return (on - fns.registration_date).days if fns.registration_date else fns.business_age_months * 30


def business_too_young(fns: FNSResult, on: date) -> bool:
    return business_days(fns, on) < 365 if fns.registration_date else fns.business_age_months < 12


def saved_sources(checks: dict) -> tuple[FNSResult, BKIResult]:
    fns_check, bki_check = checks["FNS"], checks["BKI"]
    fns, bki = fns_check.response_data or {}, bki_check.response_data or {}
    registration = fns.get("registration_date")
    return (
        FNSResult(status=fns_check.status, is_active=fns.get("is_active"),
                  business_age_months=fns.get("business_age_months"),
                  registration_date=date.fromisoformat(registration) if registration is not None else None,
                  okved=fns.get("okved"), annual_revenue=fns.get("annual_revenue"),
                  annual_operating_expenses=fns.get("annual_operating_expenses")),
        BKIResult(status=bki_check.status, current_overdue_days=bki.get("current_overdue_days"),
                  monthly_debt_payments=bki.get("monthly_debt_payments"),
                  total_payments_12m=bki.get("total_payments_12m"),
                  delayed_payments_12m=bki.get("delayed_payments_12m"),
                  active_loans_count=bki.get("active_loans_count"),
                  credit_limit_total=bki.get("credit_limit_total")),
    )
