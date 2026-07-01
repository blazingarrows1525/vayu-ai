"""Typed settings loaded from the environment (12-factor)."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),  # local app env, then monorepo root
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Runtime
    environment: str = "development"
    log_level: str = "info"
    # Security — per-client requests/min on /v1/* (fail-open if Redis is down).
    rate_limit_per_min: int = 120

    # Data tier (shared with the product plane)
    database_url: str = "postgresql://vayu:vayu@localhost:5432/vayu"
    redis_url: str = "redis://localhost:6379/0"

    # Auth bridge — verify Better Auth JWTs against its JWKS endpoint.
    auth_jwks_url: str = "http://localhost:3000/api/auth/jwks"
    auth_jwt_issuer: str = "vayu"
    auth_jwt_audience: str = "vayu-ai"
    # Dev-only: accept the literal token "dev" so the AI plane can run before the
    # product plane exists. MUST stay false outside local development.
    auth_allow_dev_token: bool = False

    # Model providers (chat)
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    gemini_api_key: str | None = None
    groq_api_key: str | None = None
    openrouter_api_key: str | None = None
    # Which provider to prefer; failover walks the rest in order if it's unconfigured.
    default_llm_provider: str = "anthropic"
    default_chat_model: str = "claude-sonnet-4-6"
    # Per-provider default models (used when a request doesn't pin one).
    openai_chat_model: str = "gpt-4o-mini"
    gemini_chat_model: str = "gemini-2.5-pro"
    groq_chat_model: str = "llama-3.3-70b-versatile"
    openrouter_chat_model: str = "anthropic/claude-3.5-sonnet"
    # Transient-error retries per LLM call (429 / 5xx / timeouts) — the SDK clients back off.
    llm_max_retries: int = 2

    # Embeddings
    embedding_provider: str = "openai"  # openai | voyage
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536
    voyage_api_key: str | None = None
    voyage_model: str = "voyage-3"

    # RAG retrieval
    rag_hybrid: bool = True  # vector + keyword fusion + MMR rerank
    rag_max_context_chars: int = 6000

    # Vector store: pgvector (default, in-DB) | qdrant | chroma | pinecone
    vector_store: str = "pgvector"
    vector_collection: str = "vayu_embeddings"
    qdrant_url: str | None = None
    qdrant_api_key: str | None = None
    chroma_url: str | None = None
    pinecone_api_key: str | None = None
    pinecone_index_host: str | None = None

    # Uploads — reject anything larger (protects the worker's memory on small dynos).
    max_upload_mb: int = 25

    # Object storage
    s3_endpoint: str = "http://localhost:9000"
    s3_region: str = "us-east-1"
    s3_bucket: str = "vayu"
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None

    # CORS — the AI plane is called server-to-server by the BFF; the browser
    # origin is allowed only for local debugging via /docs.
    cors_origins: list[str] = ["http://localhost:3000"]

    # Observability
    sentry_dsn: str | None = None
    otel_exporter_otlp_endpoint: str | None = None
    otel_service_name: str = "vayu-ai"


@lru_cache
def get_settings() -> Settings:
    return Settings()
