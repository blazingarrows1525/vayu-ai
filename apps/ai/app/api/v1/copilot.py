"""AI writing copilot — real streaming generation over SSE (Module 2).

Streams token deltas from the model, emits a usage event (tokens + cost) that the
BFF persists to the ai_generation ledger, and caches completions in Redis for
idempotent re-requests. Degrades gracefully when no model key is configured.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.core.prompts import SUPPORTED_COMMANDS, build_prompt
from app.core.security import Principal, get_principal, require_workspace
from app.services.cache import cache_get, cache_set
from app.services.llm import LLMUnavailable, Usage, resolve_llm

router = APIRouter()


class CopilotRequest(BaseModel):
    command: str
    document_id: str | None = None
    selection: str | None = None
    context: str | None = None
    tone: str | None = None
    model: str | None = None
    provider: str | None = None  # anthropic | openai | gemini | groq | openrouter


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _idempotency_key(req: CopilotRequest, model: str) -> str:
    raw = "|".join(
        [req.command, req.selection or "", req.context or "", req.tone or "",
         model, req.provider or ""]
    )
    return "gen:" + hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _chunks(text: str, size: int = 5) -> list[str]:
    words = text.split(" ")
    return [" ".join(words[i : i + size]) + " " for i in range(0, len(words), size)]


async def _generate(
    req: CopilotRequest, principal: Principal, settings: Settings
) -> AsyncIterator[str]:
    requested_model = req.model  # None lets each provider use its own default
    label_model = req.model or settings.default_chat_model
    key = _idempotency_key(req, label_model)

    try:
        provider = resolve_llm(settings, req.provider)
    except LLMUnavailable:
        provider = None
    provider_name = (
        provider.provider if provider is not None
        else (req.provider or settings.default_llm_provider)
    )

    # Idempotency: replay a cached completion instead of re-billing the provider.
    cached = await cache_get(key)
    if cached is not None:
        for chunk in _chunks(cached):
            yield _sse("token", {"delta": chunk})
            await asyncio.sleep(0)
        yield _sse(
            "usage",
            {"promptTokens": 0, "completionTokens": 0, "costUsd": 0,
             "model": label_model, "provider": provider_name, "cached": True},
        )
        yield _sse("done", {"cached": True})
        return

    system, user = build_prompt(req.command, req.selection, req.context, req.tone)

    if provider is None:
        notice = (
            f"[{req.command}] Copilot is wired end-to-end. Configure a model provider key "
            "(ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY / GROQ_API_KEY / "
            "OPENROUTER_API_KEY) to stream real output."
        )
        for chunk in _chunks(notice):
            yield _sse("token", {"delta": chunk})
            await asyncio.sleep(0.01)
        yield _sse(
            "usage",
            {"promptTokens": 0, "completionTokens": 0, "costUsd": 0,
             "model": label_model, "provider": provider_name, "configured": False},
        )
        yield _sse("done", {})
        return

    collected: list[str] = []
    try:
        async for kind, payload in provider.stream(
            system=system, prompt=user, model=requested_model
        ):
            if kind == "token" and isinstance(payload, str):
                collected.append(payload)
                yield _sse("token", {"delta": payload})
            elif kind == "usage" and isinstance(payload, Usage):
                await cache_set(key, "".join(collected))
                yield _sse(
                    "usage",
                    {"promptTokens": payload.input_tokens,
                     "completionTokens": payload.output_tokens,
                     "costUsd": payload.cost_usd, "model": payload.model,
                     "provider": payload.provider},
                )
    except Exception as exc:  # noqa: BLE001 - surface provider errors to the client
        yield _sse("error", {"message": str(exc)})

    yield _sse("done", {})


@router.post("/copilot")
async def copilot(
    req: CopilotRequest,
    principal: Principal = Depends(get_principal),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    require_workspace(principal)
    if req.command not in SUPPORTED_COMMANDS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported command: {req.command}",
        )
    return StreamingResponse(
        _generate(req, principal, settings), media_type="text/event-stream"
    )
