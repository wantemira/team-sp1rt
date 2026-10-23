import logging
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import (
    Application,
    ApplicationDocument,
    ApplicationStatusHistory,
    Client,
    User,
)
from app.repositories import application_repository
from app.schemas.applications import (
    ApplicationCreate,
    EmployeeActionRequest,
    EmployeeApplicationDetail,
    EmployeeApplicationShort,
    QueueStatus,
)

logger = logging.getLogger(__name__)


def _commit(db: Session) -> None:
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Database commit failed.")
        raise


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
    return application


def create_application(
    db: Session, user: User, data: ApplicationCreate
) -> Application:
    client = _client_or_forbidden(user)
    application = Application(
        client_id=client.id,
        product_type=data.product_type.value,
        requested_amount=data.requested_amount,
        requested_term_months=data.requested_term_months,
        purpose=data.purpose,
        status="CHECKING",
        business_data=data.business_data,
    )
    db.add(application)
    db.flush()
    db.add(
        ApplicationStatusHistory(
            application_id=application.id,
            previous_status="DRAFT",
            new_status="CHECKING",
            changed_by="CLIENT",
            comment="Application submitted.",
        )
    )
    _commit(db)
    return _get_client_application(db, user, application.id)


def get_client_application(
    db: Session, user: User, application_id: int
) -> Application:
    return _get_client_application(db, user, application_id)


def fill_application(
    db: Session, user: User, application_id: int, business_data: dict[str, Any]
) -> Application:
    application = _get_client_application(db, user, application_id)
    if application.status != "NEEDS_INFO":
        raise HTTPException(
            status_code=409,
            detail="Application is not waiting for additional information.",
        )

    previous_status = application.status
    application.business_data = _merge_dict(application.business_data, business_data)
    application.status = "CHECKING"
    db.add(
        ApplicationStatusHistory(
            application_id=application.id,
            previous_status=previous_status,
            new_status=application.status,
            changed_by="CLIENT",
            comment="Requested application information was provided.",
        )
    )
    _commit(db)
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
                    "product_type",
                    "requested_amount",
                    "requested_term_months",
                    "purpose",
                    "status",
                    "business_data",
                    "score",
                    "risk_grade",
                    "decision_reason_code",
                    "approved_amount",
                    "approved_rate",
                    "created_at",
                    "updated_at",
                    "documents",
                    "status_history",
                    "checks",
                )
            },
            "client_id": application.client_id,
            "client": application.client,
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
    if application.status in {"APPROVED", "REJECTED"}:
        raise HTTPException(
            status_code=400, detail="Application already has a final decision."
        )
    if decision.action.value in {"REJECT", "REQUEST_INFO"} and not decision.decision_reason_code:
        raise HTTPException(
            status_code=400,
            detail="decision_reason_code is required for REJECT and REQUEST_INFO.",
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
        application.approved_rate = decision.approved_rate

    db.add(
        ApplicationStatusHistory(
            application_id=application.id,
            previous_status=previous_status,
            new_status=new_status,
            changed_by="EMPLOYEE",
            comment=decision.comment,
        )
    )
    _commit(db)
    return application_repository.get_employee_application(db, application_id)  # type: ignore[return-value]
