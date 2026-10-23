from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_employee
from app.db.session import get_db
from app.models import User
from app.schemas.applications import (
    EmployeeActionRequest,
    EmployeeApplicationDetail,
    EmployeeApplicationShort,
    QueueStatus,
    ApplicationResponse,
)
from app.services import application_service

router = APIRouter(prefix="/employee/applications", tags=["Employee"])


@router.get("", response_model=list[EmployeeApplicationShort])
def get_queue(
    status: QueueStatus = QueueStatus.MANUAL_REVIEW,
    user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> list[EmployeeApplicationShort]:
    return application_service.get_employee_queue(db, status)


@router.get("/{id}", response_model=EmployeeApplicationDetail)
def get_application(
    id: int,
    _user: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> EmployeeApplicationDetail:
    return application_service.get_employee_application(db, id)


@router.post("/{id}/action", response_model=ApplicationResponse)
def decide_application(
    id: int,
    decision: EmployeeActionRequest,
    employee: User = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    return application_service.employee_decision(db, employee, id, decision)
