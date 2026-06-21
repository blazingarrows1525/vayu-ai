"""Agent Command Center (Module 5). LangGraph runtime implemented in Phase 7."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.security import Principal, get_principal

router = APIRouter(prefix="/agents")

AGENT_TYPES = [
    "research",
    "writing",
    "seo",
    "docs",
    "proofread",
    "interview",
    "resume",
]


@router.get("")
async def list_agents(principal: Principal = Depends(get_principal)) -> dict[str, list[str]]:
    return {"agents": AGENT_TYPES}
