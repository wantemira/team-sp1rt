from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import uuid

def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Перехватывает наши raise HTTPException и переделывает в единый формат"""
    error_code = "UNAUTHORIZED" if exc.status_code == 401 else "FORBIDDEN" if exc.status_code == 403 else "ERROR"
    if exc.status_code == 404: error_code = "NOT_FOUND"
    if exc.status_code == 409: error_code = "CONFLICT"
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": error_code,
            "message": exc.detail,
            "field_errors": {},
            "request_id": str(uuid.uuid4())
        }
    )

def custom_validation_exception_handler(request: Request, exc: RequestValidationError):
    """Перехватывает ошибки валидации Pydantic (422)"""
    field_errors = {}
    for error in exc.errors():
        loc = error["loc"]
        field_name = loc[-1] if len(loc) > 1 else "body"
        field_errors[str(field_name)] = error["msg"]

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "code": "VALIDATION_ERROR",
            "message": "Проверьте заполнение заявки",
            "field_errors": field_errors,
            "request_id": str(uuid.uuid4())
        }
    )