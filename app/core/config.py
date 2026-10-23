import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Required environment variable {name} is not set.")
    return value


@dataclass(frozen=True)
class Settings:
    database_url: str
    jwt_secret: str
    jwt_algorithm: str
    access_token_expire_minutes: int
    upload_dir: Path
    max_upload_size_bytes: int
    api_prefix: str


settings = Settings(
    database_url=_required_env("DATABASE_URL"),
    jwt_secret=_required_env("JWT_SECRET"),
    jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
    access_token_expire_minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")),
    upload_dir=Path(os.getenv("UPLOAD_DIR", "storage/uploads")),
    max_upload_size_bytes=int(os.getenv("MAX_UPLOAD_SIZE_BYTES", str(10 * 1024 * 1024))),
    api_prefix=os.getenv("API_PREFIX", "/api/v1"),
)

if settings.access_token_expire_minutes <= 0:
    raise RuntimeError("ACCESS_TOKEN_EXPIRE_MINUTES must be greater than zero.")
if settings.max_upload_size_bytes <= 0:
    raise RuntimeError("MAX_UPLOAD_SIZE_BYTES must be greater than zero.")
