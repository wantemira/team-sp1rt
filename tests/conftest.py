import os

from collections.abc import Generator

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite://")
os.environ.setdefault("JWT_SECRET", "test-only-secret-that-is-not-used-outside-tests")
os.environ.setdefault("UPLOAD_DIR", "storage/test-uploads")


@pytest.fixture()
def auth_client() -> Generator:
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session, sessionmaker
    from sqlalchemy.pool import StaticPool

    from app.db.base import Base
    from app.db.session import get_db
    from app.main import app
    from app.seed_test_users import seed_test_users

    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    test_session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(engine)

    with test_session.begin() as db:
        seed_test_users(db, "passw")

    def override_get_db() -> Generator[Session, None, None]:
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(engine)
        engine.dispose()
