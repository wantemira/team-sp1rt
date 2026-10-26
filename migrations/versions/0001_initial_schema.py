"""Создание основных таблиц кредитного кабинета.

Ревизия: 0001_initial_schema
Предыдущая ревизия:
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])

    op.create_table(
        "clients",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("inn", sa.String(length=12), nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("client_type", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_clients_user_id", "clients", ["user_id"], unique=True)
    op.create_index("ix_clients_inn", "clients", ["inn"])

    op.create_table(
        "employees",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("position", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_employees_user_id", "employees", ["user_id"], unique=True)

    op.create_table(
        "applications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=False),
        sa.Column("product_type", sa.String(length=32), nullable=False),
        sa.Column("requested_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("requested_term_months", sa.Integer(), nullable=False),
        sa.Column("purpose", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("business_data", sa.JSON(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("risk_grade", sa.String(length=8), nullable=True),
        sa.Column("decision_reason_code", sa.String(length=128), nullable=True),
        sa.Column("approved_amount", sa.Numeric(18, 2), nullable=True),
        sa.Column("approved_rate", sa.Numeric(8, 4), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_applications_client_id", "applications", ["client_id"])
    op.create_index("ix_applications_status", "applications", ["status"])

    op.create_table(
        "application_status_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id"), nullable=False),
        sa.Column("previous_status", sa.String(length=32), nullable=True),
        sa.Column("new_status", sa.String(length=32), nullable=False),
        sa.Column("changed_by", sa.String(length=32), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_application_status_history_application_id",
        "application_status_history",
        ["application_id"],
    )

    op.create_table(
        "application_checks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id"), nullable=False),
        sa.Column("check_type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("response_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_application_checks_application_id",
        "application_checks",
        ["application_id"],
    )

    op.create_table(
        "application_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id"), nullable=False),
        sa.Column("document_type", sa.String(length=100), nullable=False),
        sa.Column("file_url", sa.String(length=1000), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_application_documents_application_id",
        "application_documents",
        ["application_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_application_documents_application_id", table_name="application_documents")
    op.drop_table("application_documents")
    op.drop_index("ix_application_checks_application_id", table_name="application_checks")
    op.drop_table("application_checks")
    op.drop_index(
        "ix_application_status_history_application_id",
        table_name="application_status_history",
    )
    op.drop_table("application_status_history")
    op.drop_index("ix_applications_status", table_name="applications")
    op.drop_index("ix_applications_client_id", table_name="applications")
    op.drop_table("applications")
    op.drop_index("ix_employees_user_id", table_name="employees")
    op.drop_table("employees")
    op.drop_index("ix_clients_inn", table_name="clients")
    op.drop_index("ix_clients_user_id", table_name="clients")
    op.drop_table("clients")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
