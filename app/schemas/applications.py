from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    field_serializer,
    model_validator,
)

from app.core.credit_policy import LoanTerm, MAX_AMOUNT, MIN_AMOUNT, TARGET_DSCR


def _require_ruble_string(value: object) -> object:
    if value is not None and not isinstance(value, str):
        raise ValueError("Monetary values must be provided as strings in rubles.")
    return value


RubleAmount = Annotated[Decimal, BeforeValidator(_require_ruble_string)]
Version = Annotated[int, Field(strict=True, ge=1)]


class ProductType(StrEnum):
    CREDIT_LINE = "credit_line"
    OVERDRAFT = "overdraft"
    TERM_LOAN = "term_loan"


class ClientType(StrEnum):
    INDIVIDUAL = "INDIVIDUAL"
    LEGAL_ENTITY = "LEGAL_ENTITY"


class ApplicationStatus(StrEnum):
    DRAFT = "DRAFT"
    CHECKING = "CHECKING"
    NEEDS_INFO = "NEEDS_INFO"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ISSUED = "ISSUED"


class EmployeeAction(StrEnum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    REQUEST_INFO = "REQUEST_INFO"


class QueueStatus(StrEnum):
    MANUAL_REVIEW = "MANUAL_REVIEW"
    CHECKING = "CHECKING"
    NEEDS_INFO = "NEEDS_INFO"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ISSUED = "ISSUED"


class ApplicationVersion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: Version


class CreditOffer(BaseModel):
    """Условия сервера: деньги в рублях, ставка в процентах годовых."""

    kind: Literal["ORIGINAL", "COUNTER_OFFER"]
    amount: Decimal = Field(gt=0)
    annual_rate_pct: Decimal = Field(ge=0)
    term_months: LoanTerm
    monthly_payment: Decimal = Field(gt=0)
    dscr: Decimal = Field(ge=TARGET_DSCR)
    requested_dscr: Decimal
    target_dscr: Decimal
    monthly_cash_flow: Decimal
    existing_debt_payments: Decimal
    max_total_debt_service: Decimal
    explanation: str


# --- 1. Типизированные финансовые данные (ТЗ п.2) ---
class Financials(BaseModel):
    model_config = ConfigDict(extra="forbid")

    annual_revenue: RubleAmount | None = Field(
        default=None, ge=0, max_digits=18, decimal_places=2
    )
    annual_expenses: RubleAmount | None = Field(
        default=None, ge=0, max_digits=18, decimal_places=2
    )


class BusinessData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    financials: Financials = Field(default_factory=Financials)


# --- 2. Клиентские схемы (ТЗ п.2) ---
class ApplicationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", json_encoders={Decimal: str})

    product_type: Literal["term_loan"]
    requested_amount: RubleAmount | None = Field(
        default=None, ge=MIN_AMOUNT, le=MAX_AMOUNT, max_digits=18, decimal_places=2
    )
    requested_term_months: LoanTerm | None = Field(default=None)
    purpose: str | None = Field(default=None, max_length=500)
    business_data: BusinessData = Field(default_factory=BusinessData)


# --- 3. Схемы действий сотрудника (ТЗ п.4) ---
class EmployeeActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", json_encoders={Decimal: str})

    action: EmployeeAction
    version: Version
    missing_fields: list[str] | None = Field(default=None)
    
    decision_reason_code: str | None = Field(default=None, max_length=128)
    approved_amount: RubleAmount | None = Field(
        default=None, ge=MIN_AMOUNT, le=MAX_AMOUNT, max_digits=18, decimal_places=2
    )
    approved_rate: Decimal | None = Field(
        default=None, ge=0, max_digits=8, decimal_places=4
    )
    comment: str | None = Field(default=None, max_length=4000)

    # Строгая валидация действий (ТЗ п.4)
    @model_validator(mode="after")
    def validate_action_payload(self):
        self.comment = self.comment.strip() if self.comment else None
        self.decision_reason_code = self.decision_reason_code.strip() if self.decision_reason_code else None
        if not self.comment:
            raise ValueError("Добавьте непустой комментарий к решению")
        if self.action != EmployeeAction.APPROVE and (self.approved_amount is not None or self.approved_rate is not None):
            raise ValueError("Условия кредита допустимы только для APPROVE")
        if self.action != EmployeeAction.REQUEST_INFO and self.missing_fields is not None:
            raise ValueError("missing_fields допустим только для REQUEST_INFO")
        if self.action == EmployeeAction.APPROVE:
            if self.approved_amount is None or not self.comment or not self.comment.strip():
                raise ValueError("Для APPROVE обязательны approved_amount и comment")
                
        elif self.action == EmployeeAction.REJECT:
            if not self.decision_reason_code or not self.comment:
                raise ValueError("Для REJECT обязательны decision_reason_code, comment")
                
        elif self.action == EmployeeAction.REQUEST_INFO:
            if not self.missing_fields or not self.decision_reason_code:
                raise ValueError("Для REQUEST_INFO обязательны missing_fields и decision_reason_code")
            
            # Разрешенные запрашиваемые поля MVP
            allowed_fields = {
                "business_data.financials.annual_revenue",
                "business_data.financials.annual_expenses"
            }
            if (
                len(self.missing_fields) != len(set(self.missing_fields))
                or not set(self.missing_fields).issubset(allowed_fields)
            ):
                raise ValueError(f"missing_fields может содержать только: {allowed_fields}")
                
        return self


# --- 4. Схемы ответов (ТЗ п.4) ---
class ApplicationDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_type: str
    file_url: str
    status: str
    created_at: datetime


class ApplicationStatusHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    previous_status: str | None
    new_status: str
    changed_by: str
    changed_by_user_id: int | None
    comment: str | None
    created_at: datetime


class ApplicationCheckResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    check_type: str
    status: str
    response_data: dict[str, Any] | None
    created_at: datetime


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, json_encoders={Decimal: str})

    id: int
    product_type: str
    requested_amount: Decimal | None
    requested_term_months: int | None
    purpose: str | None
    status: str
    business_data: BusinessData
    score: int | None
    risk_grade: str | None
    decision_reason_code: str | None
    scoring_result: dict[str, Any] | None
    approved_amount: Decimal | None
    approved_rate: Decimal | None
    offer: CreditOffer | None = None
    signed_at: datetime | None
    issued_at: datetime | None
    created_at: datetime
    updated_at: datetime
    
    # Новые поля из ТЗ (п.4)
    version: int
    next_actions: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    info_comment: str | None = None
    
    documents: list[ApplicationDocumentResponse] = Field(default_factory=list)
    checks: list[ApplicationCheckResponse] = Field(default_factory=list)
    status_history: list[ApplicationStatusHistoryResponse] = Field(default_factory=list)

    @field_serializer("business_data")
    def serialize_business_data(self, value: BusinessData) -> dict[str, Any]:
        return value.model_dump(mode="json", exclude_none=True)


class EmployeeClientSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    inn: str
    company_name: str
    client_type: str


class EmployeeApplicationShort(BaseModel):
    model_config = ConfigDict(from_attributes=True, json_encoders={Decimal: str})

    id: int
    company_name: str
    requested_amount: Decimal | None
    risk_grade: str | None
    status: str
    created_at: datetime


class EmployeeApplicationDetail(ApplicationResponse):
    client_id: int
    client: EmployeeClientSummary


class ApplicationPatch(BaseModel):
    model_config = ConfigDict(extra="forbid", json_encoders={Decimal: str})

    version: Version
    requested_amount: RubleAmount | None = Field(
        default=None, ge=MIN_AMOUNT, le=MAX_AMOUNT, max_digits=18, decimal_places=2
    )
    requested_term_months: LoanTerm | None = Field(default=None)
    purpose: str | None = Field(default=None, max_length=500)
    business_data: BusinessData = Field(default_factory=BusinessData)

    @model_validator(mode="after")
    def require_application_changes(self) -> "ApplicationPatch":
        if not self.model_fields_set.difference({"version"}):
            raise ValueError("At least one application field must be provided.")
        return self


class ApplicationFill(BaseModel):
    model_config = ConfigDict(extra="forbid", json_encoders={Decimal: str})

    version: Version
    business_data: BusinessData

    @model_validator(mode="after")
    def require_financial_information(self) -> "ApplicationFill":
        if not self.business_data.financials.model_fields_set:
            raise ValueError("At least one financial field must be provided.")
        return self
