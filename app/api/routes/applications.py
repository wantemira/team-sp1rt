from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_client, get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.applications import (
    ApplicationCreate,
    ApplicationFill,
    ApplicationResponse,
    ApplicationDocumentResponse,
)
from app.services import application_service

router = APIRouter(tags=["Client"])


@router.post(
    "/applications",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_application(
    request: ApplicationCreate,
    user: User = Depends(get_current_client),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    return application_service.create_application(db, user, request)


@router.get("/applications/{id}", response_model=ApplicationResponse)
def get_application(
    id: int,
    user: User = Depends(get_current_client),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    return application_service.get_client_application(db, user, id)


@router.patch("/applications/{id}/fill", response_model=ApplicationResponse)
def fill_application(
    id: int,
    request: ApplicationFill,
    user: User = Depends(get_current_client),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    return application_service.fill_application(db, user, id, request.business_data)


@router.post(
    "/applications/{id}/documents",
    response_model=ApplicationDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_document(
    id: int,
    document_type: str = Form(min_length=1, max_length=100),
    file: UploadFile = File(...),
    user: User = Depends(get_current_client),
    db: Session = Depends(get_db),
) -> ApplicationDocumentResponse:
    document = application_service.upload_document(
        db, user, id, document_type, file
    )
    return ApplicationDocumentResponse.model_validate(document)


@router.get("/applications/{id}/documents/{document_id}/file")
def download_document(
    id: int,
    document_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    document, file_path = application_service.get_document_file(
        db, user, id, document_id
    )
    return FileResponse(
        path=Path(file_path),
        media_type="application/octet-stream",
        filename=f"{document.document_type}-{document.id}",
    )
