"""add nomenclature code/unit and operation batch_id

Revision ID: 768d6f4b9e69
Revises: b67df9778128
Create Date: 2026-08-05 15:07:56.089054

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "768d6f4b9e69"
down_revision: Union[str, Sequence[str], None] = "b67df9778128"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    op.add_column(
        "nomenclature", sa.Column("code", sa.String(length=50), nullable=True)
    )
    op.add_column(
        "nomenclature", sa.Column("unit", sa.String(length=20), nullable=True)
    )
    op.add_column("stock_operations", sa.Column("batch_id", sa.UUID(), nullable=True))
    op.create_index(
        op.f("ix_stock_operations_batch_id"),
        "stock_operations",
        ["batch_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_stock_operations_batch_id"), table_name="stock_operations")
    op.drop_column("stock_operations", "batch_id")
    op.drop_column("nomenclature", "unit")
    op.drop_column("nomenclature", "code")
