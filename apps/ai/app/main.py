"""ASGI entrypoint for the VAYU AI intelligence plane."""

from __future__ import annotations

import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.observability import setup_observability
from app.core.ratelimit import allow_request
from app.rag.vectorstore import vector_store_status
from app.services.llm import provider_status

settings = get_settings()


def _log_startup_warnings(cfg: Settings) -> None:
    """Fail-soft config validation: warn loudly (don't crash) on missing keys so the
    service still boots and surfaces exact status via /v1/providers."""
    slog = structlog.get_logger("startup")
    if not any(p["available"] for p in provider_status(cfg)):
        slog.warning(
            "no_llm_provider_configured",
            hint="set one of ANTHROPIC_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY",
        )
    embed_key = cfg.openai_api_key if cfg.embedding_provider == "openai" else cfg.voyage_api_key
    if not embed_key:
        slog.warning(
            "embeddings_key_missing",
            provider=cfg.embedding_provider,
            hint="RAG needs an embeddings key (OPENAI_API_KEY or VOYAGE_API_KEY)",
        )
    vs = vector_store_status(cfg)
    if vs["external"] and not vs["available"]:
        slog.warning(
            "vector_store_selected_but_unavailable",
            store=vs["store"],
            hint="set its URL/API key or use VECTOR_STORE=pgvector",
        )


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    _log_startup_warnings(settings)
    yield
    # Shutdown: dispose pools.


app = FastAPI(
    title="VAYU AI — Intelligence Plane",
    version="0.1.0",
    description="RAG, embeddings, and LangGraph agents. Authenticated via Better Auth JWTs (JWKS).",
    lifespan=lifespan,
)

setup_observability(app, settings)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path.startswith("/v1/"):
        client = request.client.host if request.client else "anon"
        window = 60
        key = f"rl:{client}:{int(time.time() // window)}"
        if not await allow_request(key, settings.rate_limit_per_min, window):
            return JSONResponse({"detail": "rate limit exceeded"}, status_code=429)
    return await call_next(request)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    structlog.contextvars.bind_contextvars(request_id=request_id)
    try:
        response = await call_next(request)
    finally:
        structlog.contextvars.clear_contextvars()
    response.headers["x-request-id"] = request_id
    return response


app.include_router(api_router, prefix="/v1")


@app.get("/", tags=["meta"])
async def root() -> dict[str, str]:
    return {"service": "vayu-ai", "plane": "intelligence", "docs": "/docs"}
