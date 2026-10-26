import logging
import os

import bcrypt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import Client, Employee, User

logger = logging.getLogger(__name__)

CLIENT_ACCOUNTS = (
    ("test.client1@example.com", "7700000001", "Test Client 1"),
    ("test.client2@example.com", "7700000002", "Test Client 2"),
    ("test.client3@example.com", "7700000003", "Test Client 3"),
    ("demo.ip@example.com", "770000000001", "ИП Алексей Демонстрационный"),
)
EMPLOYEE_ACCOUNTS = (
    ("test.employee1@example.com", "Test Employee 1"),
    ("test.employee2@example.com", "Test Employee 2"),
)


def seed_test_users(db: Session, password: str) -> tuple[int, int]:
    password_bytes = password.encode("utf-8")
    if not password_bytes or len(password_bytes) > 72:
        raise ValueError("TEST_USERS_PASSWORD must be between 1 and 72 UTF-8 bytes.")

    password_hash = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")
    clients_created = 0
    employees_created = 0

    for email, inn, company_name in CLIENT_ACCOUNTS:
        user = _get_or_create_user(db, email, "client", password_hash)
        if user.client_profile is None:
            user.client_profile = Client(
                inn=inn,
                company_name=company_name,
                client_type="INDIVIDUAL" if len(inn) == 12 else "LEGAL_ENTITY",
            )
            clients_created += 1

    for email, full_name in EMPLOYEE_ACCOUNTS:
        user = _get_or_create_user(db, email, "employee", password_hash)
        if user.employee_profile is None:
            user.employee_profile = Employee(
                full_name=full_name,
                position="Test Loan Officer",
            )
            employees_created += 1

    db.flush()
    return clients_created, employees_created


def _get_or_create_user(
    db: Session, email: str, role: str, password_hash: str
) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, role=role, password_hash=password_hash)
        db.add(user)
        db.flush()
    elif user.role != role:
        raise RuntimeError(
            f"Seed account {email} exists with role {user.role!r}; expected {role!r}."
        )
    return user


def main() -> None:
    if os.getenv("SEED_TEST_USERS", "").lower() != "true":
        logger.info("Test account seeding is disabled.")
        return

    password = os.getenv("TEST_USERS_PASSWORD")
    if not password:
        raise RuntimeError(
            "TEST_USERS_PASSWORD must be set when SEED_TEST_USERS=true."
        )

    with SessionLocal.begin() as db:
        clients_created, employees_created = seed_test_users(db, password)
    logger.info(
        "Test accounts ready: %d client profiles and %d employee profiles created.",
        clients_created,
        employees_created,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
