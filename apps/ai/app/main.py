"""ASGI entrypoint for the VAYU AI intelligence plane."""

from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/v1")


@app.get("/", tags=["meta"])
async def root() -> dict[str, str]:
    return {"service": "vayu-ai", "plane": "intelligence", "docs": "/docs"}
