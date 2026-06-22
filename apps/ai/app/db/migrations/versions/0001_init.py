"""init intelligence-plane schema (pgvector)

Revision ID: 0001
Revises:
Create Date: 2026-06-22
"""
from __future__ import annotations

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.execute(
        """
        CREATE TABLE knowledge_source (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            workspace_id uuid NOT NULL,
            document_id uuid,
            title varchar(512) NOT NULL,
            source_type varchar(32) NOT NULL,
            storage_key varchar(512),
            status varchar(32) NOT NULL DEFAULT 'processing',
            error text,
            chunk_count int NOT NULL DEFAULT 0,
            token_count int NOT NULL DEFAULT 0,
            created_by uuid,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX knowledge_source_workspace_idx ON knowledge_source (workspace_id)")

    op.execute(
        """
        CREATE TABLE embedding (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            knowledge_source_id uuid NOT NULL REFERENCES knowledge_source(id) ON DELETE CASCADE,
            workspace_id uuid NOT NULL,
            document_id uuid,
            chunk_index int NOT NULL,
            content text NOT NULL,
            token_count int NOT NULL DEFAULT 0,
            embedding vector(1536) NOT NULL,
            metadata jsonb NOT NULL DEFAULT '{}',
            created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX embedding_workspace_idx ON embedding (workspace_id)")
    op.execute("CREATE INDEX embedding_source_idx ON embedding (knowledge_source_id)")
    op.execute(
        "CREATE INDEX embedding_hnsw ON embedding USING hnsw (embedding vector_cosine_ops)"
    )

    op.execute(
        """
        CREATE TABLE agent_run (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            workspace_id uuid NOT NULL,
            user_id uuid NOT NULL,
            agent_type varchar(32) NOT NULL,
            input jsonb NOT NULL DEFAULT '{}',
            status varchar(16) NOT NULL DEFAULT 'queued',
            output jsonb,
            checkpoint jsonb,
            total_tokens int NOT NULL DEFAULT 0,
            cost_usd double precision NOT NULL DEFAULT 0,
            started_at timestamptz,
            finished_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX agent_run_workspace_idx ON agent_run (workspace_id)")

    op.execute(
        """
        CREATE TABLE agent_step (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            agent_run_id uuid NOT NULL REFERENCES agent_run(id) ON DELETE CASCADE,
            step_index int NOT NULL,
            node varchar(64) NOT NULL,
            type varchar(16) NOT NULL,
            input jsonb,
            output jsonb,
            tokens int NOT NULL DEFAULT 0,
            latency_ms int NOT NULL DEFAULT 0,
            created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX agent_step_run_idx ON agent_step (agent_run_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS agent_step")
    op.execute("DROP TABLE IF EXISTS agent_run")
    op.execute("DROP TABLE IF EXISTS embedding")
    op.execute("DROP TABLE IF EXISTS knowledge_source")
