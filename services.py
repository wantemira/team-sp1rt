from sqlalchemy.orm import Session
from typing import List, Dict, Any

# --- СЕКЦИЯ ДЛЯ ГЕРМАНА ---
# Все функции ниже — ЗАГЛУШКИ. Когда Герман напишет свою логику, 
# он заменит их тела на реальные вызовы к БД и скорингу.

def create_draft(db: Session, user_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    """Создать черновик заявки. Возвращает заявку."""
    return {
        "id": 1, # В реальности: db.add(Application(...)); db.commit(); db.refresh(app); return app
        "user_id": user_id,
        "product_id": data["product_id"],
        "requested_amount": data["requested_amount"],
        "term_months": data["term_months"],
        "purpose_code": data["purpose_code"],
        "status": "draft",
        "version": 1,
        "next_actions": ["edit", "submit"],
        "missing_fields": []
    }

def get_application(db: Session, app_id: int, user_id: int, role: str) -> Dict[str, Any]:
    """Получить заявку по ID с проверкой прав."""
    return {
        "id": app_id,
        "user_id": user_id,
        "product_id": "working_capital",
        "requested_amount": 150000000,
        "term_months": 12,
        "purpose_code": "WORKING_CAPITAL",
        "status": "draft",
        "version": 1,
        "next_actions": ["edit", "submit"],
        "missing_fields": []
    }

def update_draft(db: Session, app_id: int, user_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    """Обновить черновик."""
    return {
        "id": app_id,
        "user_id": user_id,
        "product_id": data.get("product_id", "working_capital"),
        "requested_amount": data.get("requested_amount", 150000000),
        "term_months": data.get("term_months", 12),
        "purpose_code": data.get("purpose_code", "WORKING_CAPITAL"),
        "status": "draft",
        "version": 2,
        "next_actions": ["submit"],
        "missing_fields": []
    }

def submit_application(db: Session, app_id: int, user_id: int) -> Dict[str, Any]:
    """Отправить заявку на рассмотрение (запуск проверок и скоринга)."""
    return {
        "id": app_id,
        "user_id": user_id,
        "product_id": "working_capital",
        "requested_amount": 150000000,
        "term_months": 12,
        "purpose_code": "WORKING_CAPITAL",
        "status": "checking",
        "version": 3,
        "next_actions": [],
        "missing_fields": []
    }

def sign_application(db: Session, app_id: int, user_id: int) -> Dict[str, Any]:
    """Подписать оффер (имитация выдачи)."""
    return {
        "id": app_id,
        "user_id": user_id,
        "product_id": "working_capital",
        "requested_amount": 150000000,
        "term_months": 12,
        "purpose_code": "WORKING_CAPITAL",
        "status": "signed",
        "version": 4,
        "next_actions": [],
        "missing_fields": []
    }

def get_employee_queue(db: Session) -> List[Dict[str, Any]]:
    """Получить очередь заявок для сотрудника."""
    return [] # Пока пусто

def employee_decision(db: Session, app_id: int, action: str, comment: str = "") -> Dict[str, Any]:
    """Действие сотрудника (approve, reject, request_info)."""
    return {"status": "ok", "message": f"Действие {action} по заявке {app_id} выполнено"}