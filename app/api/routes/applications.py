from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_client, get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.applications import (
    ApplicationCreate,
    ApplicationFill,
    ApplicationPatch,
    ApplicationResponse,
    ApplicationDocumentResponse,
)
from app.services import application_service

router = APIRouter(tags=["Client"])

@router.get("/products")
def get_products():
    """Единственный продукт MVP (ТЗ п.2)"""
    return [{
        "id": "term_loan",
        "name": "Кредит на оборотные средства",
        "min_amount": "100000.00",
        "max_amount": "5000000.00",
        "terms": [6, 12, 24]
    }]

@router.get("/news")
def get_news(user: User = Depends(get_current_client)):
    """Персонализированные синтетические новости (ТЗ п.3)"""
    return [{
        "id": 1, 
        "title": "Добро пожаловать!", 
        "text": "Вы можете подать заявку на кредит до 5 млн рублей."
    }]


# --- Заявки ---

@router.post("/applications", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
def create_application(
    request: ApplicationCreate,
    user: User = Depends(get_current_client),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    return application_service.create_application(db, user, request)


@router.get("/applications", response_model=list[ApplicationResponse])
def list_applications(
    user: User = Depends(get_current_client),
    db: Session = Depends(get_db),
) -> list[ApplicationResponse]:
    # Сервис должен возвращать только заявки этого user.id
    return application_service.get_client_applications(db, user)


@router.get("/applications/{id}", response_model=ApplicationResponse)
def get_application(
    id: int,
    user: User = Depends(get_current_client),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    return application_service.get_client_application(db, user, id)


@router.patch("/applications/{id}", response_model=ApplicationResponse)
def patch_application(
    id: int,
    request: ApplicationPatch,
    user: User = Depends(get_current_client),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    # В сервисе проверить version!
    return application_service.patch_application(db, user, id, request)


@router.patch("/applications/{id}/fill", response_model=ApplicationResponse)
def fill_application(
    id: int,
    request: ApplicationFill,
    user: User = Depends(get_current_client),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    # Передаем весь request (там есть version и business_data)
    return application_service.fill_application(db, user, id, request)


@router.post("/applications/{id}/submit", response_model=ApplicationResponse)
def submit_application(
    id: int,
    version: int, # По ТЗ передаем version
    user: User = Depends(get_current_client),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    return application_service.submit_application(db, user, id, version)


@router.post("/applications/{id}/sign", response_model=ApplicationResponse)
def sign_application(
    id: int,
    version: int, # По ТЗ передаем version
    user: User = Depends(get_current_client),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    return application_service.sign_application(db, user, id, version)


# --- Документы (существующие ручки) ---

@router.post("/applications/{id}/documents", response_model=ApplicationDocumentResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    id: int,
    document_type: str = Form(min_length=1, max_length=100),
    file: UploadFile = File(...),
    user: User = Depends(get_current_client),
    db: Session = Depends(get_db),
) -> ApplicationDocumentResponse:
    document = application_service.upload_document(db, user, id, document_type, file)
    return ApplicationDocumentResponse.model_validate(document)


@router.get("/applications/{id}/documents/{document_id}/file")
def download_document(
    id: int,
    document_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    document, file_path = application_service.get_document_file(db, user, id, document_id)
    return FileResponse(
        path=Path(file_path),
        media_type="application/octet-stream",
        filename=f"{document.document_type}-{document.id}",
    )