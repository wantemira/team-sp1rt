from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


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


class EmployeeAction(StrEnum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    REQUEST_INFO = "REQUEST_INFO"


class QueueStatus(StrEnum):
    MANUAL_REVIEW = "MANUAL_REVIEW"
    CHECKING = "CHECKING"
    NEEDS_INFO = "NEEDS_INFO"


class ApplicationCreate(BaseModel):
    product_type: ProductType
    requested_amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    requested_term_months: int = Field(gt=0, le=120)
    purpose: str | None = Field(default=None, max_length=500)
    business_data: dict[str, Any]


class ApplicationFill(BaseModel):
    business_data: dict[str, Any] = Field(min_length=1)


class EmployeeActionRequest(BaseModel):
    action: EmployeeAction
    decision_reason_code: str | None = Field(default=None, max_length=128)
    approved_amount: Decimal | None = Field(
        default=None, gt=0, max_digits=18, decimal_places=2
    )
    approved_rate: Decimal | None = Field(
        default=None, ge=0, max_digits=8, decimal_places=4
    )
    comment: str | None = Field(default=None, max_length=4000)


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
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_type: str
    requested_amount: Decimal
    requested_term_months: int
    purpose: str | None
    status: str
    business_data: dict[str, Any]
    score: int | None
    risk_grade: str | None
    decision_reason_code: str | None
    approved_amount: Decimal | None
    approved_rate: Decimal | None
    created_at: datetime
    updated_at: datetime
    documents: list[ApplicationDocumentResponse] = Field(default_factory=list)
    status_history: list[ApplicationStatusHistoryResponse] = Field(default_factory=list)


class EmployeeClientSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    inn: str
    company_name: str
    client_type: str


class EmployeeApplicationShort(BaseModel):
    id: int
    company_name: str
    requested_amount: Decimal
    risk_grade: str | None
    status: str
    created_at: datetime


class EmployeeApplicationDetail(ApplicationResponse):
    client_id: int
    client: EmployeeClientSummary
    checks: list[ApplicationCheckResponse] = Field(default_factory=list)
