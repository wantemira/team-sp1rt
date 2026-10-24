from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.models import User
from app.repositories import user_repository
from app.schemas.auth import (
    AuthenticatedUserResponse,
    ClientProfile,
    EmployeeProfile,
    LoginResponse,
    UserProfile,
)


def _profile_response(user: User) -> AuthenticatedUserResponse:
    if user.role == "client" and user.client_profile is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Client account has no linked client profile.",
        )
    if user.role == "employee" and user.employee_profile is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Employee account has no linked employee profile.",
        )
    if user.role not in {"client", "employee"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account role is not allowed to access this service.",
        )

    return AuthenticatedUserResponse(
        user=UserProfile.model_validate(user),
        client=(
            ClientProfile.model_validate(user.client_profile)
            if user.client_profile is not None
            else None
        ),
        employee=(
            EmployeeProfile.model_validate(user.employee_profile)
            if user.employee_profile is not None
            else None
        ),
    )


def login(db: Session, email: str, password: str) -> LoginResponse:
    user = user_repository.get_by_email(db, email)
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    profile = _profile_response(user)
    return LoginResponse(
        access_token=create_access_token(user),
        expires_in=settings.access_token_expire_minutes * 60,
        user=profile.user,
        client=profile.client,
        employee=profile.employee,
    )


def get_profile(user: User) -> AuthenticatedUserResponse:
    return _profile_response(user)
