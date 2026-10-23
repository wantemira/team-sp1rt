from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import User


def get_by_email(db: Session, email: str) -> User | None:
    statement = (
        select(User)
        .options(joinedload(User.client_profile), joinedload(User.employee_profile))
        .where(User.email == email)
    )
    return db.scalar(statement)


def get_by_id(db: Session, user_id: int) -> User | None:
    statement = (
        select(User)
        .options(joinedload(User.client_profile), joinedload(User.employee_profile))
        .where(User.id == user_id)
    )
    return db.scalar(statement)
