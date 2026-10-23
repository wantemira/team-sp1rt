from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.auth import AuthenticatedUserResponse, LoginRequest, LoginResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=LoginResponse)
def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
) -> LoginResponse:
    return auth_service.login(db, request.email, request.password)


@router.get("/me", response_model=AuthenticatedUserResponse)
def get_me(user: User = Depends(get_current_user)) -> AuthenticatedUserResponse:
    return auth_service.get_profile(user)
