"""add exports and export_items tables

Revision ID: 92ff18d07554
Revises: 768d6f4b9e69
Create Date: 2026-08-07 13:24:59.305836

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "92ff18d07554"
down_revision: Union[str, Sequence[str], None] = "768d6f4b9e69"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "exports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("invoice_number", sa.String(length=50), nullable=True),
        sa.Column("contract_name", sa.String(length=200), nullable=True),
        sa.Column("released_by", sa.String(length=150), nullable=True),
        sa.Column("received_by", sa.String(length=150), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_exports_id"), "exports", ["id"], unique=False)
    op.create_table(
        "export_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("export_id", sa.Integer(), nullable=False),
        sa.Column("stock_operation_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["export_id"], ["exports.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["stock_operation_id"],
            ["stock_operations.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_export_items_export_id"),
        "export_items",
        ["export_id"],
        unique=False,
    )
    op.create_index(op.f("ix_export_items_id"), "export_items", ["id"], unique=False)
    op.create_index(
        op.f("ix_export_items_stock_operation_id"),
        "export_items",
        ["stock_operation_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_export_items_stock_operation_id"), table_name="export_items")
    op.drop_index(op.f("ix_export_items_id"), table_name="export_items")
    op.drop_index(op.f("ix_export_items_export_id"), table_name="export_items")
    op.drop_table("export_items")
    op.drop_index(op.f("ix_exports_id"), table_name="exports")
    op.drop_table("exports")
