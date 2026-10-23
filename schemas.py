from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict

# --- Схемы для заявок ---

class ApplicationCreate(BaseModel):
    product_id: str = Field(..., description="ID кредитного продукта")
    requested_amount: int = Field(..., gt=0, description="Сумма запроса в КОПЕЙКАХ (например, 150000000 = 1.5 млн)")
    term_months: int = Field(..., gt=0, le=120, description="Срок в месяцах")
    purpose_code: str = Field(..., description="Код цели кредита")

class ApplicationPatch(BaseModel):
    # Все поля опциональны, так как это PATCH (редактирование черновика)
    product_id: Optional[str] = None
    requested_amount: Optional[int] = Field(None, gt=0, description="Сумма запроса в КОПЕЙКАХ")
    term_months: Optional[int] = Field(None, gt=0, le=120)
    purpose_code: Optional[str] = None

class ApplicationResponse(BaseModel):
    id: int
    product_id: str
    requested_amount: int
    term_months: int
    purpose_code: str
    status: str
    version: int
    # Поля для фронтенда:
    next_actions: List[str] = Field(default_factory=list, description="Доступные действия для текущего пользователя")
    missing_fields: List[str] = Field(default_factory=list, description="Каких полей не хватает для завершения")
    
    class Config:
        from_attributes = True # Позволяет Pydantic читать данные из объектов БД

# --- Схемы для фронтенда (каталог) ---

class ProductResponse(BaseModel):
    id: str
    name: str
    min_amount: int  # в копейках
    max_amount: int  # в копейках
    min_term: int
    max_term: int