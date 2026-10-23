from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.orm import Session

from schemas import ApplicationCreate, ApplicationPatch, ApplicationResponse, ProductResponse
from auth import get_current_client, get_current_manager
from services import (
    create_draft, get_application, update_draft, 
    submit_application, sign_application, 
    get_employee_queue, employee_decision
)
from db import get_db

router = APIRouter(tags=["Applications"])



@router.get("/products", response_model=List[ProductResponse])
def get_products(payload: dict = Depends(get_current_client)):
    # Заглушка, пока Герман не напишет ProductService
    return [{"id": "working_capital", "name": "Оборотный кредит", "min_amount": 10000000, "max_amount": 500000000, "min_term": 3, "max_term": 36}]

@router.post("/applications", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
def create_application(data: ApplicationCreate, payload: dict = Depends(get_current_client), db: Session = Depends(get_db)):
    # Берем user_id из токена и вызываем Германа
    user_id = payload["user_id"]
    result = create_draft(db, user_id, data.model_dump())
    return result

@router.get("/applications", response_model=List[ApplicationResponse])
def get_my_applications(payload: dict = Depends(get_current_client)):
    return [] # Пока пусто

@router.get("/applications/{app_id}", response_model=ApplicationResponse)
def get_application_by_id(app_id: int, payload: dict = Depends(get_current_client), db: Session = Depends(get_db)):
    user_id = payload["user_id"]
    result = get_application(db, app_id, user_id, payload["role"])
    return result

@router.patch("/applications/{app_id}", response_model=ApplicationResponse)
def update_application(app_id: int, data: ApplicationPatch, payload: dict = Depends(get_current_client), db: Session = Depends(get_db)):
    user_id = payload["user_id"]
    result = update_draft(db, app_id, user_id, data.model_dump(exclude_unset=True))
    return result

@router.post("/applications/{app_id}/submit", response_model=ApplicationResponse)
def submit_application_route(app_id: int, payload: dict = Depends(get_current_client), db: Session = Depends(get_db)):
    user_id = payload["user_id"]
    result = submit_application(db, app_id, user_id)
    return result

@router.post("/applications/{app_id}/sign", response_model=ApplicationResponse)
def sign_application_route(app_id: int, payload: dict = Depends(get_current_client), db: Session = Depends(get_db)):
    user_id = payload["user_id"]
    result = sign_application(db, app_id, user_id)
    return result


# --- РУЧКИ МЕНЕДЖЕРА ---

@router.get("/employee/applications", response_model=List[ApplicationResponse])
def get_employee_queue_route(payload: dict = Depends(get_current_manager), db: Session = Depends(get_db)):
    result = get_employee_queue(db)
    return result

@router.get("/employee/applications/{app_id}", response_model=ApplicationResponse)
def get_employee_application(app_id: int, payload: dict = Depends(get_current_manager), db: Session = Depends(get_db)):
    result = get_application(db, app_id, payload["user_id"], payload["role"])
    return result

@router.post("/employee/applications/{app_id}/request-info")
def employee_request_info(app_id: int, payload: dict = Depends(get_current_manager), db: Session = Depends(get_db)):
    result = employee_decision(db, app_id, "request_info")
    return result

@router.post("/employee/applications/{app_id}/approve")
def employee_approve(app_id: int, payload: dict = Depends(get_current_manager), db: Session = Depends(get_db)):
    result = employee_decision(db, app_id, "approve")
    return result

@router.post("/employee/applications/{app_id}/reject")
def employee_reject(app_id: int, payload: dict = Depends(get_current_manager), db: Session = Depends(get_db)):
    result = employee_decision(db, app_id, "reject")
    return result