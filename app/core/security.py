from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings
from app.models.user import User


def verify_password(plain_password: str, password_hash: str) -> bool:
    password_bytes = plain_password.encode("utf-8")
    if len(password_bytes) > 72:
        return False
    return bcrypt.checkpw(password_bytes, password_hash.encode("utf-8"))


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
