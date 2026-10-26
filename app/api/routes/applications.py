from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_client, get_current_user
from app.api.versioning import requested_version
from app.core.credit_policy import MAX_AMOUNT, MIN_AMOUNT, PRODUCT_ID, PRODUCT_NAME, TERMS
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
from app.schemas.products import ProductResponse
from app.schemas.news import NewsItem
from app.services.news_service import get_client_news

router = APIRouter(tags=["Client"])

@router.get("/products", response_model=list[ProductResponse])
def get_products() -> list[dict]:
    """Оборотный кредит и ограничения продукта."""
    return [{
        "id": PRODUCT_ID,
        "name": PRODUCT_NAME,
        "min_amount": str(MIN_AMOUNT),
        "max_amount": str(MAX_AMOUNT),
        "terms": list(TERMS),
        "disbursement_count": 1,
        "term_type": "fixed",
        "repayment_type": "annuity",
    }]

@router.get("/news", response_model=list[NewsItem])
def get_news(
    user: User = Depends(get_current_client),
    db: Session = Depends(get_db),
) -> list[NewsItem]:
    """Синтетические материалы по профилю клиента и его последней заявке."""
    return get_client_news(db, user)


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
    return application_service.patch_application(db, user, id, request)


@router.post("/applications/{id}/submit", response_model=ApplicationResponse)
def submit_application(
    id: int,
    version: int = Depends(requested_version),
    user: User = Depends(get_current_client),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    return application_service.submit_application(db, user, id, version)


@router.post("/applications/{id}/fill", response_model=ApplicationResponse)
@router.patch("/applications/{id}/fill", response_model=ApplicationResponse, include_in_schema=False)
def fill_application(
    id: int,
    request: ApplicationFill,
    user: User = Depends(get_current_client),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    return application_service.fill_application(db, user, id, request)


@router.post("/applications/{id}/sign", response_model=ApplicationResponse)
def sign_application(
    id: int,
    version: int = Depends(requested_version),
    user: User = Depends(get_current_client),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    return application_service.sign_application(db, user, id, version)


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
