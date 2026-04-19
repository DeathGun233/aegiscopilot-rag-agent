from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0001_initial_sql_persistence"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "conversations",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("owner_id", sa.Text(), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
    )
    op.create_index("idx_conversations_owner_id", "conversations", ["owner_id"])

    op.create_table(
        "documents",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.Column("index_state", sa.Text(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
    )

    op.create_table(
        "chunks",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("document_id", sa.Text(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("has_embedding", sa.Integer(), nullable=False),
        sa.Column("embedding_version", sa.Text(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
    )
    op.create_index("idx_chunks_document_id", "chunks", ["document_id"])

    op.create_table(
        "document_tasks",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("document_id", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
    )
    op.create_index("idx_document_tasks_document_id", "document_tasks", ["document_id"])

    op.create_table(
        "tasks",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
    )
    op.create_index("idx_tasks_user_id", "tasks", ["user_id"])

    op.create_table(
        "users",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
    )

    op.create_table(
        "sessions",
        sa.Column("token", sa.Text(), primary_key=True),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.Text(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
    )
    op.create_index("idx_sessions_user_id", "sessions", ["user_id"])
    op.create_index("idx_sessions_expires_at", "sessions", ["expires_at"])

    op.create_table(
        "runtime_settings",
        sa.Column("key", sa.Text(), primary_key=True),
        sa.Column("payload", sa.Text(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("runtime_settings")
    op.drop_index("idx_sessions_expires_at", table_name="sessions")
    op.drop_index("idx_sessions_user_id", table_name="sessions")
    op.drop_table("sessions")
    op.drop_table("users")
    op.drop_index("idx_tasks_user_id", table_name="tasks")
    op.drop_table("tasks")
    op.drop_index("idx_document_tasks_document_id", table_name="document_tasks")
    op.drop_table("document_tasks")
    op.drop_index("idx_chunks_document_id", table_name="chunks")
    op.drop_table("chunks")
    op.drop_table("documents")
    op.drop_index("idx_conversations_owner_id", table_name="conversations")
    op.drop_table("conversations")
