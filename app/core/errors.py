import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


def _error_code(status_code: int) -> str:
    return {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        413: "FILE_TOO_LARGE",
    }.get(status_code, "REQUEST_ERROR")


async def http_exception_handler(
    _request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, dict):
        message = str(detail.get("message", "Не удалось выполнить запрос."))
        details = detail.get("details")
        if details is None:
            details = {key: value for key, value in detail.items() if key not in {"message", "error_code", "details"}} or None
        code = str(detail.get("error_code", _error_code(exc.status_code)))
    else:
        message = str(detail)
        details = None
        code = _error_code(exc.status_code)

    return JSONResponse(
        status_code=exc.status_code,
        content={"error_code": code, "message": message, "details": details},
        headers=exc.headers,
    )


async def validation_exception_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    field_errors = [
        {"field": ".".join(str(part) for part in error["loc"]), "message": error["msg"]}
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "error_code": "VALIDATION_ERROR",
            "message": "Проверьте поля запроса.",
            "details": {"fields": field_errors},
        },
    )


async def internal_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled API error: %s %s", request.method, request.url.path,
                 exc_info=(type(exc), exc, exc.__traceback__))
    return JSONResponse(status_code=500, content={
        "error_code": "INTERNAL_ERROR",
        "message": "Внутренняя ошибка сервера. Обновите заявку перед повторным действием.",
        "details": None,
    })


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, internal_exception_handler)
