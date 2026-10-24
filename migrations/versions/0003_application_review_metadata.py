"""Persist requested information and review actor metadata.

Revision ID: 0003_application_review_metadata
Revises: 0002_application_drafts
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_application_review_metadata"
down_revision: Union[str, None] = "0002_application_drafts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("applications") as batch_op:
        batch_op.add_column(
            sa.Column(
                "missing_fields",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'[]'"),
            )
        )
        batch_op.add_column(sa.Column("info_comment", sa.Text(), nullable=True))
        batch_op.add_column(
            sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.add_column(
            sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True)
        )

    with op.batch_alter_table("application_status_history") as batch_op:
        batch_op.add_column(sa.Column("changed_by_user_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_application_status_history_changed_by_user_id_users",
            "users",
            ["changed_by_user_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("application_status_history") as batch_op:
        batch_op.drop_constraint(
            "fk_application_status_history_changed_by_user_id_users",
            type_="foreignkey",
        )
        batch_op.drop_column("changed_by_user_id")

    with op.batch_alter_table("applications") as batch_op:
        batch_op.drop_column("issued_at")
        batch_op.drop_column("signed_at")
        batch_op.drop_column("info_comment")
        batch_op.drop_column("missing_fields")
