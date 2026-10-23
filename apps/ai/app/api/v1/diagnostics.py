"""Self-check behind the web app's /status page.

Requires the user's JWT, so a 200 here already proves the web → AI bridge (AI_SERVICE_URL,
AUTH_JWKS_URL, issuer/audience) works. Reports which provider backs each feature, the AI
schema, and optionally makes one tiny LLM call to prove the key actually works. Never returns
secrets — only provider names, booleans and short error messages.
"""

from __future__ import annotations

import asyncio
import shutil
from urllib.parse import urlparse

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.security import Principal, get_principal
from app.db.base import get_session
from app.services.embeddings import Embedder
from app.services.llm import generate, provider_status
from app.services.video import VideoService
from app.services.voice import VoiceService

router = APIRouter()

_AI_TABLES = ("knowledge_source", "embedding", "agent_run", "agent_step")


def _short(exc: BaseException) -> str:
    return f"{type(exc).__name__}: {exc}"[:240]


async def _database(session: AsyncSession, settings: Settings) -> dict:
    try:
        tables = {
            name: (await session.execute(text(f"SELECT to_regclass('public.{name}')"))).scalar()
            is not None
            for name in _AI_TABLES
        }
        pgvector = (await session.execute(
            text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')")
        )).scalar()
        column_dim = None
        if tables["embedding"]:
            column_dim = (await session.execute(text(
                "SELECT atttypmod FROM pg_attribute "
                "WHERE attrelid = 'embedding'::regclass AND attname = 'embedding'"
            ))).scalar()
        return {
            "ok": all(tables.values()) and bool(pgvector) and column_dim == settings.embedding_dim,
            "tables": tables,
            "pgvector": bool(pgvector),
            "embedding_column_dim": column_dim,
            "embedding_dim_setting": settings.embedding_dim,
        }
    except Exception as exc:  # noqa: BLE001 - reported to the status page
        return {"ok": False, "error": _short(exc)}


async def _llm_probe(settings: Settings) -> dict:
    try:
        reply, usage = await asyncio.wait_for(
            generate(settings, system="Reply with the single word OK.", prompt="ping",
                     max_tokens=5),
            timeout=45,
        )
        return {"ok": True, "provider": usage.provider, "model": usage.model}
    except Exception as exc:  # noqa: BLE001 - reported to the status page
        return {"ok": False, "error": _short(exc)}


@router.get("/diagnostics")
async def diagnostics(
    probe: bool = False,
    principal: Principal = Depends(get_principal),
    settings: Settings = Depends(get_settings),
    session: AsyncSession = Depends(get_session),
) -> dict:
    voice = VoiceService(settings)
    video = VideoService(settings)
    embedder = Embedder(settings)
    return {
        "auth": {"ok": True, "has_workspace": bool(principal.workspace_id)},
        "jwks_host": urlparse(settings.auth_jwks_url).netloc,
        "llm": {
            "default": settings.default_llm_provider,
            "configured": [p["provider"] for p in provider_status(settings) if p["available"]],
            "probe": await _llm_probe(settings) if probe else None,
        },
        "voice": {"stt": voice.provider, "tts": voice.tts_provider},
        "video": {"provider": video.provider},
        "embeddings": {
            "provider": embedder.provider,
            "model": embedder.active_model,
            "available": embedder.available,
        },
        "ffmpeg": shutil.which("ffmpeg") is not None,
        "database": await _database(session, settings),
    }
