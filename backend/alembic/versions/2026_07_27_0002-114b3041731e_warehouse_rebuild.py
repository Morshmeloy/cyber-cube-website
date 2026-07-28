"""warehouse rebuild

Revision ID: 114b3041731e
Revises: 33d3a7e6f96c
Create Date: 2026-07-27 00:02:41.194021

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "114b3041731e"
down_revision: Union[str, Sequence[str], None] = "33d3a7e6f96c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "nomenclature",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("base_quantity", sa.Float(), nullable=False),
        sa.Column("base_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_nomenclature_id"), "nomenclature", ["id"], unique=False)
    op.create_index(op.f("ix_nomenclature_name"), "nomenclature", ["name"], unique=True)
    op.create_table(
        "stock_operations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.UUID(), nullable=False),
        sa.Column("nomenclature_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column(
            "operation_type",
            sa.Enum("ISSUE", "RETURN", name="operationtype"),
            nullable=False,
        ),
        sa.Column("person", sa.String(length=150), nullable=False),
        sa.Column("destination", sa.String(length=200), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["nomenclature_id"],
            ["nomenclature.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )
    op.create_index(
        op.f("ix_stock_operations_id"),
        "stock_operations",
        ["id"],
        unique=False,
    )
    op.drop_index(op.f("ix_warehouse_items_id"), table_name="warehouse_items")
    op.drop_index(op.f("ix_warehouse_items_name"), table_name="warehouse_items")
    op.drop_table("warehouse_items")
    sa.Enum(name="movementtype").drop(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    op.create_table(
        "warehouse_items",
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column("name", sa.VARCHAR(length=100), autoincrement=False, nullable=False),
        sa.Column(
            "quantity",
            sa.DOUBLE_PRECISION(precision=53),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "movement_type",
            postgresql.ENUM("IN", "OUT", name="movementtype"),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "date",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "person",
            sa.VARCHAR(length=100),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column("user_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("warehouse_items_user_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("warehouse_items_pkey")),
    )
    op.create_index(
        op.f("ix_warehouse_items_name"),
        "warehouse_items",
        ["name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_warehouse_items_id"), "warehouse_items", ["id"], unique=False
    )
    op.drop_index(op.f("ix_stock_operations_id"), table_name="stock_operations")
    op.drop_table("stock_operations")
    op.drop_index(op.f("ix_nomenclature_name"), table_name="nomenclature")
    op.drop_index(op.f("ix_nomenclature_id"), table_name="nomenclature")
    op.drop_table("nomenclature")
    sa.Enum(name="operationtype").drop(op.get_bind(), checkfirst=True)
