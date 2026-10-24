from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), index=True)
    product_type: Mapped[str] = mapped_column(String(32))
    requested_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(18, 2), nullable=True
    )
    requested_term_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    purpose: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    business_data: Mapped[dict[str, Any]] = mapped_column(JSON)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    risk_grade: Mapped[str | None] = mapped_column(String(8), nullable=True)
    decision_reason_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    scoring_result: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True
    )
    approved_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(18, 2), nullable=True
    )
    approved_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(8, 4), nullable=True
    )
    missing_fields: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    info_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    signed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    issued_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    client: Mapped["Client"] = relationship(back_populates="applications")
    status_history: Mapped[list["ApplicationStatusHistory"]] = relationship(
        back_populates="application",
        order_by="(ApplicationStatusHistory.created_at, ApplicationStatusHistory.id)",
    )
    checks: Mapped[list["ApplicationCheck"]] = relationship(
        back_populates="application",
        order_by="(ApplicationCheck.created_at, ApplicationCheck.id)",
    )
    documents: Mapped[list["ApplicationDocument"]] = relationship(
        back_populates="application", order_by="ApplicationDocument.created_at"
    )

    __mapper_args__ = {"version_id_col": version}
