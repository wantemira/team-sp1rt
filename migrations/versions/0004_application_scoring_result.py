"""Store the full scoring calculation result.

Revision ID: 0004_application_scoring_result
Revises: 0003_application_review_metadata
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004_application_scoring_result"
down_revision: Union[str, None] = "0003_application_review_metadata"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "applications",
        sa.Column("scoring_result", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("applications", "scoring_result")
