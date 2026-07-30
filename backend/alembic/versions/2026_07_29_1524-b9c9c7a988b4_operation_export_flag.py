"""operation export flag

Revision ID: b9c9c7a988b4
Revises: 91e23e0ef5c2
Create Date: 2026-07-29 15:24:19.709002

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b9c9c7a988b4"
down_revision: Union[str, Sequence[str], None] = "91e23e0ef5c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "stock_operations",
        sa.Column("exported_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("stock_operations", "exported_at")
