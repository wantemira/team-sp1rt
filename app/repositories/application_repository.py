from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Application, ApplicationDocument, Client


_application_details = (
    selectinload(Application.status_history),
    selectinload(Application.checks),
    selectinload(Application.documents),
    joinedload(Application.client),
)


def get_client_profile(db: Session, user_id: int) -> Client | None:
    return db.scalar(select(Client).where(Client.user_id == user_id))


def get_client_application(
    db: Session, application_id: int, client_id: int
) -> Application | None:
    statement = (
        select(Application)
        .options(*_application_details)
        .where(
            Application.id == application_id,
            Application.client_id == client_id,
        )
    )
    return db.scalar(statement)


def get_client_applications(db: Session, client_id: int) -> list[Application]:
    statement = (
        select(Application)
        .options(*_application_details)
        .where(Application.client_id == client_id)
        .order_by(Application.created_at.desc(), Application.id.desc())
    )
    return list(db.scalars(statement).unique())


def get_employee_application(db: Session, application_id: int) -> Application | None:
    statement = (
        select(Application)
        .options(*_application_details)
        .where(Application.id == application_id)
    )
    return db.scalar(statement)


def get_employee_queue(
    db: Session, status_filter: str
) -> list[Application]:
    statement = (
        select(Application)
        .options(joinedload(Application.client))
        .where(Application.status == status_filter)
        .order_by(Application.created_at.asc())
    )
    return list(db.scalars(statement).unique())


def get_document(db: Session, application_id: int, document_id: int) -> ApplicationDocument | None:
    return db.scalar(
        select(ApplicationDocument).where(
            ApplicationDocument.id == document_id,
            ApplicationDocument.application_id == application_id,
        )
    )
