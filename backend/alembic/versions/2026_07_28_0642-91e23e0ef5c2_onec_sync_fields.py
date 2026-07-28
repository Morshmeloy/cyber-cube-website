"""onec sync fields

Revision ID: 91e23e0ef5c2
Revises: e99c7ede08df
Create Date: 2026-07-28 06:42:43.042356

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "91e23e0ef5c2"
down_revision: Union[str, Sequence[str], None] = "e99c7ede08df"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("audit_log", "user_id", existing_type=sa.INTEGER(), nullable=True)
    op.add_column(
        "nomenclature",
        sa.Column("source_guid", sa.String(length=36), nullable=True),
    )
    op.create_index(
        op.f("ix_nomenclature_source_guid"),
        "nomenclature",
        ["source_guid"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_nomenclature_source_guid"), table_name="nomenclature")
    op.drop_column("nomenclature", "source_guid")
    op.alter_column("audit_log", "user_id", existing_type=sa.INTEGER(), nullable=False)
