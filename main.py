from fastapi import FastAPI
from sqlalchemy import text
from db import engine
from auth import router as auth_router
from api_applications import router as api_app_router # <-- ДОБАВИЛИ
from errors import custom_http_exception_handler, custom_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

app = FastAPI()

app.add_exception_handler(StarletteHTTPException, custom_http_exception_handler)
app.add_exception_handler(RequestValidationError, custom_validation_exception_handler)

app.include_router(auth_router)
app.include_router(api_app_router)

@app.get("/health/db")
def health_db():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"db": "ok"}