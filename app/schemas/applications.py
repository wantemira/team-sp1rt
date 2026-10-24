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


def _require_ruble_string(value: object) -> object:
    if value is not None and not isinstance(value, str):
        raise ValueError("Monetary values must be provided as strings in rubles.")
    return value


RubleAmount = Annotated[Decimal, BeforeValidator(_require_ruble_string)]


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


# --- 1. Типизированные финансовые данные (ТЗ п.2) ---
class Financials(BaseModel):
    annual_revenue: RubleAmount | None = Field(
        default=None, ge=0, max_digits=18, decimal_places=2
    )
    annual_expenses: RubleAmount | None = Field(
        default=None, ge=0, max_digits=18, decimal_places=2
    )


class BusinessData(BaseModel):
    financials: Financials = Field(default_factory=Financials)


# --- 2. Клиентские схемы (ТЗ п.2) ---
class ApplicationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", json_encoders={Decimal: str})

    product_type: Literal["term_loan"]
    requested_amount: RubleAmount | None = Field(
        default=None, ge=100000, le=5000000, max_digits=18, decimal_places=2
    )
    requested_term_months: Literal[6, 12, 24] | None = Field(default=None)
    purpose: str | None = Field(default=None, max_length=500)
    business_data: BusinessData = Field(default_factory=BusinessData)


# --- 3. Схемы действий сотрудника (ТЗ п.4) ---
class EmployeeActionRequest(BaseModel):
    model_config = ConfigDict(json_encoders={Decimal: str})

    action: EmployeeAction
    version: int = Field(ge=1)
    missing_fields: list[str] | None = Field(default=None)
    
    decision_reason_code: str | None = Field(default=None, max_length=128)
    approved_amount: RubleAmount | None = Field(
        default=None, gt=0, max_digits=18, decimal_places=2
    )
    approved_rate: Decimal | None = Field(
        default=None, ge=0, max_digits=8, decimal_places=4
    )
    comment: str | None = Field(default=None, max_length=4000)

    # Строгая валидация действий (ТЗ п.4)
    @model_validator(mode="after")
    def validate_action_payload(self):
        if self.action == EmployeeAction.APPROVE:
            if self.approved_amount is None or not self.comment:
                raise ValueError("Для APPROVE обязательны approved_amount и comment")
            if self.approved_rate is not None and self.approved_rate != Decimal("28"):
                raise ValueError("Для продукта установлена ставка 28% годовых.")
                
        elif self.action == EmployeeAction.REJECT:
            if not self.decision_reason_code or not self.comment:
                raise ValueError("Для REJECT обязательны decision_reason_code, comment")
                
        elif self.action == EmployeeAction.REQUEST_INFO:
            if not self.missing_fields or not self.comment:
                raise ValueError("Для REQUEST_INFO обязательны непустой missing_fields и comment")
            
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

    version: int = Field(ge=1)
    requested_amount: RubleAmount | None = Field(
        default=None, ge=100000, le=5000000, max_digits=18, decimal_places=2
    )
    requested_term_months: Literal[6, 12, 24] | None = Field(default=None)
    purpose: str | None = Field(default=None, max_length=500)
    business_data: BusinessData = Field(default_factory=BusinessData)

    @model_validator(mode="after")
    def require_application_changes(self) -> "ApplicationPatch":
        if not self.model_fields_set.difference({"version"}):
            raise ValueError("At least one application field must be provided.")
        return self


class ApplicationFill(BaseModel):
    model_config = ConfigDict(extra="forbid", json_encoders={Decimal: str})

    version: int = Field(ge=1)
    business_data: BusinessData

    @model_validator(mode="after")
    def require_financial_information(self) -> "ApplicationFill":
        if not self.business_data.financials.model_fields_set:
            raise ValueError("At least one financial field must be provided.")
        return self