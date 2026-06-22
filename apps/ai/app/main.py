"""ASGI entrypoint for the VAYU AI intelligence plane."""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.observability import setup_observability

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Startup: connection pools, OTel, cache warmup are wired in Phase 2/11.
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
