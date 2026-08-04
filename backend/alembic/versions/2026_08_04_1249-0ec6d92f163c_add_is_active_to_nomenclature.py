"""add is_active to nomenclature

Revision ID: 0ec6d92f163c
Revises: 1382fc3ff8ad
Create Date: 2026-08-04 12:49:55.962997

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0ec6d92f163c"
down_revision: Union[str, Sequence[str], None] = "1382fc3ff8ad"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "nomenclature",
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("nomenclature", "is_active")
