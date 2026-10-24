from fastapi import FastAPI
from sqlalchemy import text

from app.api.routes import applications, auth, employee_applications
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.db.session import engine

app = FastAPI(
    title="Alfa Smart Credit API",
    version="1.0.0",
    description="API для кредитного кабинета действующих клиентов и банковских сотрудников.",
)
register_exception_handlers(app)
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(applications.router, prefix=settings.api_prefix)
app.include_router(employee_applications.router, prefix=settings.api_prefix)


@app.get("/health/db", tags=["Health"])
def health_db() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"db": "ok"}
