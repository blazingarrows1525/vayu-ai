"""size the embedding column to EMBEDDING_DIM

0001 hard-coded vector(1536) while the ORM column is Vector(EMBEDDING_DIM), so a 1024-dim setup
(the Render blueprint's default) failed every insert.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-23
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

from app.core.config import get_settings

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    dim = int(get_settings().embedding_dim)
    bind = op.get_bind()
    current = bind.execute(sa.text(
        "SELECT atttypmod FROM pg_attribute "
        "WHERE attrelid = 'embedding'::regclass AND attname = 'embedding'"
    )).scalar()
    if current == dim:
        return
    if bind.execute(sa.text("SELECT EXISTS (SELECT 1 FROM embedding)")).scalar():
        # Stored vectors can't be resized; leave them and re-index with a matching provider.
        print(f"[migrate] embedding column is vector({current}) but EMBEDDING_DIM={dim}; "
              "table has rows, not resizing")
        return
    op.execute("DROP INDEX IF EXISTS embedding_hnsw")
    op.execute(f"ALTER TABLE embedding ALTER COLUMN embedding TYPE vector({dim})")
    op.execute(
        "CREATE INDEX embedding_hnsw ON embedding USING hnsw (embedding vector_cosine_ops)"
    )


def downgrade() -> None:
    pass
