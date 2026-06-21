"""AI writing copilot — streaming SSE endpoint (Module 2).

This scaffolds the contract and auth; Phase 5 swaps the stub generator for a
real provider stream and writes the ai_generation ledger row.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.security import Principal, get_principal

router = APIRouter()

SUPPORTED_COMMANDS = {
    "/rewrite",
    "/improve",
    "/continue",
    "/summarize",
    "/expand",
    "/shorten",
    "/fix-grammar",
    "/change-tone",
    "/generate-outline",
    "/generate-blog",
    "/generate-email",
    "/generate-docs",
}


class CopilotRequest(BaseModel):
    command: str
    document_id: str | None = None
    selection: str | None = None
    context: str | None = None
    tone: str | None = None


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _stream(req: CopilotRequest, principal: Principal) -> AsyncIterator[str]:
    # Phase 5 replaces this with a real model stream (OpenAI/Anthropic/Gemini).
    demo = (
        f"[{req.command}] VAYU copilot is wired for {principal.user_id}. "
        "Real model streaming arrives in Phase 5."
    )
    for word in demo.split():
        yield _sse("token", {"delta": word + " "})
        await asyncio.sleep(0.02)
    yield _sse("usage", {"promptTokens": 0, "completionTokens": 0, "costUsd": 0})
    yield _sse("done", {"generationId": None})


@router.post("/copilot")
async def copilot(
    req: CopilotRequest,
    principal: Principal = Depends(get_principal),
) -> StreamingResponse:
    if req.command not in SUPPORTED_COMMANDS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported command: {req.command}",
        )
    return StreamingResponse(_stream(req, principal), media_type="text/event-stream")
