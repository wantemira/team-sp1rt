from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models import User
from app.repositories import user_repository

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Войдите в кабинет для выполнения действия.',
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "role", "exp"]},
        )
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, TypeError, ValueError, KeyError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Сессия завершена. Войдите в кабинет снова.',
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user = user_repository.get_by_id(db, user_id)
    if user is None or user.role != payload["role"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Сессия завершена. Войдите в кабинет снова.',
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_role(role: str) -> Callable:
    def role_dependency(user: User = Depends(get_current_user)) -> User:
        if user.role != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Это действие доступно только сотруднику." if role == "employee" else "Это действие доступно только клиенту.",
            )
        return user

    return role_dependency


get_current_client = require_role("client")
get_current_employee = require_role("employee")
