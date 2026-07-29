"""operation 1c confirmation flag

Revision ID: 1382fc3ff8ad
Revises: b9c9c7a988b4
Create Date: 2026-07-29 23:48:12.642075

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "1382fc3ff8ad"
down_revision: Union[str, Sequence[str], None] = "b9c9c7a988b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "stock_operations",
        sa.Column("confirmed_in_1c_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("stock_operations", "confirmed_in_1c_at")
