import logging
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm.exc import StaleDataError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import (
    Application,
    ApplicationCheck,
    ApplicationDocument,
    ApplicationStatusHistory,
    Client,
    User,
)
from app.integrations import bki_mock, fns_mock
from app.repositories import application_repository
from app.schemas.applications import (
    ApplicationCreate,
    ApplicationFill,
    ApplicationPatch,
    BusinessData,
    EmployeeActionRequest,
    EmployeeApplicationDetail,
    EmployeeApplicationShort,
    QueueStatus,
)
from app.services.credit_evaluation import evaluate_credit

logger = logging.getLogger(__name__)

FINANCIAL_FIELD_PATHS = {
    "business_data.financials.annual_revenue": "annual_revenue",
    "business_data.financials.annual_expenses": "annual_expenses",
}
ANNUAL_INTEREST_RATE = Decimal("28.0000")


def _commit(db: Session) -> None:
    try:
        db.commit()
    except StaleDataError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Application was changed by another request. Reload it and retry.",
        ) from exc
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Database commit failed.")
        raise


def _check_version(application: Application, expected_version: int) -> None:
    if application.version != expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Application version is stale. Reload it and retry.",
        )


def _serialize_business_data(
    data: BusinessData, *, exclude_unset: bool = False
) -> dict[str, Any]:
    serialized = data.model_dump(
        mode="json",
        exclude_none=not exclude_unset,
        exclude_unset=exclude_unset,
    )
    financials = serialized.get("financials")
    if not exclude_unset and not financials:
        serialized["financials"] = {}
    return serialized


def _merge_dict(target: dict[str, Any], update: dict[str, Any]) -> dict[str, Any]:
    merged = dict(target)
    for key, value in update.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _merge_dict(merged[key], value)
        else:
            merged[key] = value
    return merged


def _client_or_forbidden(user: User) -> Client:
    if user.role != "client":
        raise HTTPException(status_code=403, detail="Client role required.")
    if user.client_profile is None:
        raise HTTPException(
            status_code=500, detail="Client account has no linked client profile."
        )
    return user.client_profile


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Application not found.")


def _get_client_application(db: Session, user: User, application_id: int) -> Application:
    client = _client_or_forbidden(user)
    application = application_repository.get_client_application(
        db, application_id, client.id
    )
    if application is None:
        raise _not_found()
    return _set_next_actions(application, "client")


def _next_actions(application: Application, role: str) -> list[str]:
    if role == "client":
        return {
            "DRAFT": ["EDIT", "SUBMIT"],
            "NEEDS_INFO": ["FILL"],
            "APPROVED": ["SIGN"],
        }.get(application.status, [])
    if role == "employee" and application.status == "MANUAL_REVIEW":
        return (
            ["RETRY_CHECKS"]
            if application.decision_reason_code == "EXTERNAL_CHECK_UNAVAILABLE"
            else ["APPROVE", "REJECT", "REQUEST_INFO"]
        )
    return []


def _set_next_actions(application: Application, role: str) -> Application:
    application.next_actions = _next_actions(application, role)
    return application


def create_application(
    db: Session, user: User, data: ApplicationCreate
) -> Application:
    client = _client_or_forbidden(user)
    application = Application(
        client_id=client.id,
        product_type=data.product_type,
        requested_amount=data.requested_amount,
        requested_term_months=data.requested_term_months,
        purpose=data.purpose,
        status="DRAFT",
        business_data=_serialize_business_data(data.business_data),
        version=1,
    )
    db.add(application)
    db.flush()
    db.add(
        ApplicationStatusHistory(
            application_id=application.id,
            previous_status=None,
            new_status="DRAFT",
            changed_by="CLIENT",
            changed_by_user_id=user.id,
            comment="Draft created.",
        )
    )
    _commit(db)
    return _get_client_application(db, user, application.id)


def get_client_applications(db: Session, user: User) -> list[Application]:
    client = _client_or_forbidden(user)
    return [
        _set_next_actions(application, "client")
        for application in application_repository.get_client_applications(
            db, client.id
        )
    ]


def get_client_application(
    db: Session, user: User, application_id: int
) -> Application:
    return _get_client_application(db, user, application_id)


def patch_application(
    db: Session, user: User, application_id: int, data: ApplicationPatch
) -> Application:
    application = _get_client_application(db, user, application_id)
    if application.status != "DRAFT":
        raise HTTPException(
            status_code=409,
            detail="Only draft applications can be edited.",
        )
    _check_version(application, data.version)

    fields = data.model_fields_set
    if "requested_amount" in fields:
        application.requested_amount = data.requested_amount
    if "requested_term_months" in fields:
        application.requested_term_months = data.requested_term_months
    if "purpose" in fields:
        application.purpose = data.purpose
    if "business_data" in fields:
        changes = _serialize_business_data(
            data.business_data, exclude_unset=True
        )
        application.business_data = _merge_dict(application.business_data, changes)

    _commit(db)
    return _get_client_application(db, user, application_id)


def submit_application(
    db: Session, user: User, application_id: int, expected_version: int
) -> Application:
    application = _get_client_application(db, user, application_id)
    _check_version(application, expected_version)
    if application.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft applications can be submitted.",
        )
    if (
        application.requested_amount is None
        or not 100000 <= application.requested_amount <= 5000000
        or application.requested_term_months not in {6, 12, 24}
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "requested_amount must be between 100000 and 5000000, and "
                "requested_term_months must be 6, 12, or 24."
            ),
        )

    return _run_credit_checks(
        db,
        application,
        changed_by="CLIENT",
        changed_by_user_id=user.id,
        transition_comment="Application submitted for review.",
    )


def fill_application(
    db: Session, user: User, application_id: int, data: ApplicationFill
) -> Application:
    application = _get_client_application(db, user, application_id)
    _check_version(application, data.version)
    if application.status != "NEEDS_INFO":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only applications that need information can be filled.",
        )
    requested_fields = set(application.missing_fields or [])
    provided_fields = data.business_data.financials.model_fields_set
    financials = data.business_data.financials
    missing_or_invalid = [
        path
        for path, field_name in FINANCIAL_FIELD_PATHS.items()
        if path in requested_fields
        and (
            field_name not in provided_fields
            or getattr(financials, field_name) is None
        )
    ]
    if not requested_fields or missing_or_invalid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Fill every requested financial field with a valid value.",
                "missing_fields": missing_or_invalid or sorted(requested_fields),
            },
        )
    changes = _serialize_business_data(data.business_data, exclude_unset=True)
    application.business_data = _merge_dict(application.business_data, changes)
    application.missing_fields = []
    application.info_comment = None
    return _run_credit_checks(
        db,
        application,
        changed_by="CLIENT",
        changed_by_user_id=user.id,
        transition_comment="Client provided requested financial information.",
    )


def retry_checks(
    db: Session, employee: User, application_id: int, expected_version: int
) -> Application:
    if employee.role != "employee":
        raise HTTPException(status_code=403, detail="Employee role required.")
    application = application_repository.get_employee_application(db, application_id)
    if application is None:
        raise _not_found()
    _check_version(application, expected_version)
    if application.status != "MANUAL_REVIEW":
        raise HTTPException(
            status_code=409,
            detail="Checks can only be retried for applications in MANUAL_REVIEW.",
        )
    if application.decision_reason_code != "EXTERNAL_CHECK_UNAVAILABLE":
        raise HTTPException(
            status_code=409,
            detail="Checks can only be retried after a technical check failure.",
        )
    latest_checks = _latest_checks(application)
    if not any(
        check.status in {"TIMEOUT", "ERROR"} for check in latest_checks.values()
    ):
        raise HTTPException(
            status_code=409,
            detail="Application has no failed external checks to retry.",
        )
    return _run_credit_checks(
        db,
        application,
        changed_by="EMPLOYEE",
        changed_by_user_id=employee.id,
        transition_comment="Employee retried unavailable external checks.",
    )


def _run_credit_checks(
    db: Session,
    application: Application,
    *,
    changed_by: str,
    changed_by_user_id: int,
    transition_comment: str,
) -> Application:
    previous_status = application.status
    try:
        fns_attempt_number = (
            sum(check.check_type == "FNS" for check in application.checks) + 1
        )
        client = application.client
        fns_result = fns_mock.get_fns_result(client.inn, fns_attempt_number)
        bki_result = bki_mock.get_bki_result(client.inn)
        evaluation = evaluate_credit(application, fns_result, bki_result)
        scoring_result = evaluation.scoring_result or {
            "model": "mvp_demo_thresholds_v1",
            "status": evaluation.status,
            "score": evaluation.score,
            "reason_code": evaluation.reason_code,
            "inputs": {
                "financials": application.business_data.get("financials") or {},
                "fns": {
                    "status": fns_result.status,
                    **fns_result.as_response_data(),
                },
                "bki": {
                    "status": bki_result.status,
                    **bki_result.as_response_data(),
                },
            },
            "decision_factors": {},
        }
        db.add_all(
            [
                ApplicationCheck(
                    application_id=application.id,
                    check_type="FNS",
                    status=fns_result.status,
                    response_data=fns_result.as_response_data(),
                ),
                ApplicationCheck(
                    application_id=application.id,
                    check_type="BKI",
                    status=bki_result.status,
                    response_data=bki_result.as_response_data(),
                ),
            ]
        )
        application.status = evaluation.status
        application.score = evaluation.score
        application.decision_reason_code = evaluation.reason_code
        application.scoring_result = scoring_result
        application.approved_amount = evaluation.approved_amount
        application.approved_rate = evaluation.approved_rate
        application.risk_grade = evaluation.risk_grade
        if evaluation.status == "NEEDS_INFO":
            application.missing_fields = list(evaluation.missing_fields)
            application.info_comment = "Provide the requested financial information."
        else:
            application.missing_fields = []
            application.info_comment = None
        db.add(
            ApplicationStatusHistory(
                application_id=application.id,
                previous_status=previous_status,
                new_status="CHECKING",
                changed_by=changed_by,
                changed_by_user_id=changed_by_user_id,
                comment=transition_comment,
            )
        )
        db.add(
            ApplicationStatusHistory(
                application_id=application.id,
                previous_status="CHECKING",
                new_status=evaluation.status,
                changed_by="SYSTEM",
                changed_by_user_id=None,
                comment=evaluation.reason_code,
            )
        )
        _commit(db)
    except Exception:
        db.rollback()
        logger.exception("Credit checks failed for application %s.", application.id)
        raise

    db.expire(application, ["status_history", "checks"])
    if changed_by == "CLIENT":
        updated_application = application_repository.get_client_application(
            db, application.id, application.client_id
        )
        if updated_application is None:
            raise _not_found()
        return _set_next_actions(updated_application, "client")
    updated_application = application_repository.get_employee_application(
        db, application.id
    )
    if updated_application is None:
        raise _not_found()
    return _set_next_actions(updated_application, "employee")


def sign_application(
    db: Session, user: User, application_id: int, expected_version: int
) -> Application:
    application = _get_client_application(db, user, application_id)
    _check_version(application, expected_version)
    if application.status != "APPROVED":
        raise HTTPException(
            status_code=409,
            detail="Only approved applications can be issued.",
        )
    if (application.approved_amount is None or application.approved_amount <= 0
            or application.approved_rate is None):
        raise HTTPException(status_code=409, detail="Approved loan terms are missing.")
    application.status = "ISSUED"
    issued_at = datetime.now(timezone.utc)
    application.signed_at = issued_at
    application.issued_at = issued_at
    db.add(
        ApplicationStatusHistory(
            application_id=application.id,
            previous_status="APPROVED",
            new_status="ISSUED",
            changed_by="CLIENT",
            changed_by_user_id=user.id,
            comment="Demo credit agreement signed and funds issued.",
        )
    )
    _commit(db)
    db.expire(application, ["status_history"])
    return _get_client_application(db, user, application_id)


def upload_document(
    db: Session,
    user: User,
    application_id: int,
    document_type: str,
    upload: UploadFile,
) -> ApplicationDocument:
    application = _get_client_application(db, user, application_id)
    if application.status == "REJECTED":
        raise HTTPException(
            status_code=409, detail="Rejected applications cannot receive documents."
        )

    file_path: Path | None = None
    try:
        contents = upload.file.read(settings.max_upload_size_bytes + 1)
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        if len(contents) > settings.max_upload_size_bytes:
            raise HTTPException(
                status_code=413,
                detail="Uploaded file exceeds the configured size limit.",
            )

        settings.upload_dir.mkdir(parents=True, exist_ok=True)
        document = ApplicationDocument(
            application_id=application.id,
            document_type=document_type,
            file_url="",
            status="PENDING",
        )
        db.add(document)
        db.flush()
        file_path = settings.upload_dir / f"{document.id}.upload"
        file_path.write_bytes(contents)
        document.file_url = (
            f"{settings.api_prefix}/applications/{application.id}/documents/"
            f"{document.id}/file"
        )
        _commit(db)
        db.refresh(document)
        return document
    except HTTPException:
        db.rollback()
        if file_path is not None:
            file_path.unlink(missing_ok=True)
        raise
    except OSError as exc:
        db.rollback()
        if file_path is not None:
            file_path.unlink(missing_ok=True)
        logger.exception("Could not store uploaded application document.")
        raise HTTPException(
            status_code=500, detail="Could not store the uploaded document."
        ) from exc
    except SQLAlchemyError:
        if file_path is not None:
            file_path.unlink(missing_ok=True)
        raise
    finally:
        upload.file.close()


def get_document_file(
    db: Session, user: User, application_id: int, document_id: int
) -> tuple[ApplicationDocument, Path]:
    document = application_repository.get_document(db, application_id, document_id)
    if document is None:
        raise _not_found()

    if user.role == "client":
        client = _client_or_forbidden(user)
        application = application_repository.get_client_application(
            db, application_id, client.id
        )
        if application is None:
            raise _not_found()
    elif user.role != "employee":
        raise HTTPException(status_code=403, detail="Client or employee role required.")

    file_path = settings.upload_dir / f"{document.id}.upload"
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Stored document file not found.")
    return document, file_path


def get_employee_queue(
    db: Session, status_filter: QueueStatus
) -> list[EmployeeApplicationShort]:
    applications = application_repository.get_employee_queue(db, status_filter.value)
    return [
        EmployeeApplicationShort(
            id=application.id,
            company_name=application.client.company_name,
            requested_amount=application.requested_amount,
            risk_grade=application.risk_grade,
            status=application.status,
            created_at=application.created_at,
        )
        for application in applications
    ]


def get_employee_application(
    db: Session, application_id: int
) -> EmployeeApplicationDetail:
    application = application_repository.get_employee_application(db, application_id)
    if application is None:
        raise _not_found()
    return EmployeeApplicationDetail.model_validate(
        {
            **{
                field: getattr(application, field)
                for field in (
                    "id",
                    "version",
                    "product_type",
                    "requested_amount",
                    "requested_term_months",
                    "purpose",
                    "status",
                    "business_data",
                    "score",
                    "risk_grade",
                    "decision_reason_code",
                    "scoring_result",
                    "approved_amount",
                    "approved_rate",
                    "offer",
                    "missing_fields",
                    "info_comment",
                    "signed_at",
                    "issued_at",
                    "created_at",
                    "updated_at",
                    "documents",
                    "status_history",
                    "checks",
                )
            },
            "client_id": application.client_id,
            "client": application.client,
            "next_actions": _next_actions(application, "employee"),
        }
    )


def employee_decision(
    db: Session,
    employee: User,
    application_id: int,
    decision: EmployeeActionRequest,
) -> Application:
    if employee.role != "employee":
        raise HTTPException(status_code=403, detail="Employee role required.")
    application = application_repository.get_employee_application(db, application_id)
    if application is None:
        raise _not_found()
    _check_version(application, decision.version)
    if application.status != "MANUAL_REVIEW":
        raise HTTPException(
            status_code=409,
            detail="Employee decisions are only available in MANUAL_REVIEW.",
        )
    latest_checks = _latest_checks(application)
    if (
        application.decision_reason_code == "EXTERNAL_CHECK_UNAVAILABLE"
        or not _required_checks_succeeded(latest_checks)
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "Employee decisions require all mandatory checks to succeed; "
                "retry technical failures."
            ),
        )
    if (
        decision.action.value in {"REJECT", "REQUEST_INFO"}
        and not decision.decision_reason_code
    ):
        raise HTTPException(
            status_code=400,
            detail="decision_reason_code is required for REJECT and REQUEST_INFO.",
        )
    if decision.action.value == "APPROVE":
        if (
            application.requested_amount is None
            or decision.approved_amount is None
            or decision.approved_amount <= 0
            or decision.approved_amount > application.requested_amount
            or decision.approved_amount > Decimal("5000000.00")
        ):
            raise HTTPException(
                status_code=422,
                detail=(
                    "approved_amount must be positive and no greater than the "
                    "requested amount or product limit."
                ),
            )
        if _has_known_stop_factor(latest_checks):
            raise HTTPException(
                status_code=409,
                detail="Applications with known stop factors cannot be approved.",
            )

    new_status = {
        "APPROVE": "APPROVED",
        "REJECT": "REJECTED",
        "REQUEST_INFO": "NEEDS_INFO",
    }[decision.action.value]
    previous_status = application.status
    application.status = new_status
    if decision.decision_reason_code is not None:
        application.decision_reason_code = decision.decision_reason_code
    if decision.action.value == "APPROVE":
        application.approved_amount = decision.approved_amount
        application.approved_rate = ANNUAL_INTEREST_RATE
    elif decision.action.value == "REQUEST_INFO":
        application.missing_fields = list(decision.missing_fields or [])
        application.info_comment = decision.comment

    db.add(
        ApplicationStatusHistory(
            application_id=application.id,
            previous_status=previous_status,
            new_status=new_status,
            changed_by="EMPLOYEE",
            changed_by_user_id=employee.id,
            comment=decision.comment,
        )
    )
    _commit(db)
    db.expire(application, ["status_history", "checks"])
    updated_application = application_repository.get_employee_application(
        db, application_id
    )
    if updated_application is None:
        raise _not_found()
    return updated_application


def _latest_checks(application: Application) -> dict[str, ApplicationCheck]:
    latest: dict[str, ApplicationCheck] = {}
    for check in application.checks:
        if check.check_type in {"FNS", "BKI"}:
            latest[check.check_type] = check
    return latest


def _required_checks_succeeded(
    checks: dict[str, ApplicationCheck],
) -> bool:
    fns = checks.get("FNS")
    bki = checks.get("BKI")
    return bool(
        fns is not None
        and bki is not None
        and fns.status == "SUCCESS"
        and bki.status == "SUCCESS"
        and fns.response_data
        and fns.response_data.get("is_active") is not None
        and fns.response_data.get("business_age_months") is not None
        and bki.response_data
        and bki.response_data.get("current_overdue_days") is not None
        and bki.response_data.get("monthly_debt_payments") is not None
    )


def _has_known_stop_factor(checks: dict[str, ApplicationCheck]) -> bool:
    if not _required_checks_succeeded(checks):
        return True
    fns = checks["FNS"].response_data or {}
    bki = checks["BKI"].response_data or {}
    return bool(
        fns["is_active"] is not True
        or fns["business_age_months"] < 12
        or bki["current_overdue_days"] > 0
    )
