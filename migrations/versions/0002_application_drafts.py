"""Неполные черновики и версия для защиты от конкурентных изменений.

Ревизия: 0002_application_drafts
Предыдущая ревизия: 0001_initial_schema
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_application_drafts"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("applications") as batch_op:
        batch_op.alter_column(
            "requested_amount",
            existing_type=sa.Numeric(18, 2),
            nullable=True,
        )
        batch_op.alter_column(
            "requested_term_months",
            existing_type=sa.Integer(),
            nullable=True,
        )
        batch_op.add_column(
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        )


def downgrade() -> None:
    with op.batch_alter_table("applications") as batch_op:
        batch_op.drop_column("version")
        batch_op.alter_column(
            "requested_term_months",
            existing_type=sa.Integer(),
            nullable=False,
        )
        batch_op.alter_column(
            "requested_amount",
            existing_type=sa.Numeric(18, 2),
            nullable=False,
        )
