"""Agent Command Center (Module 5) — LangGraph agents."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.registry import AGENTS
from app.agents.runner import run_and_persist, stream_run
from app.core.config import Settings, get_settings
from app.core.security import Principal, get_principal, require_workspace
from app.db.base import get_session
from app.db.models import AgentRun, AgentStep

router = APIRouter(prefix="/agents")


class RunRequest(BaseModel):
    task: str


@router.get("")
async def list_agents(principal: Principal = Depends(get_principal)) -> dict:
    return {
        "agents": [
            {"type": a.type, "label": a.label, "description": a.description}
            for a in AGENTS.values()
        ]
    }


@router.post("/{agent_type}/run")
async def run_agent(
    agent_type: str,
    req: RunRequest,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    workspace_id = require_workspace(principal)
    if agent_type not in AGENTS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown agent type")

    agent_run, steps = await run_and_persist(
        session,
        settings,
        agent_type=agent_type,
        task=req.task,
        user_id=principal.user_id,
        workspace_id=workspace_id,
    )
    return {
        "runId": str(agent_run.id),
        "status": agent_run.status,
        "output": (agent_run.output or {}).get("result", ""),
        "totalTokens": agent_run.total_tokens,
        "steps": [
            {"node": s["node"], "type": s["type"], "tokens": s.get("tokens", 0)}
            for s in steps
        ],
    }


@router.post("/{agent_type}/stream")
async def stream_agent(
    agent_type: str,
    req: RunRequest,
    principal: Principal = Depends(get_principal),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    require_workspace(principal)
    if agent_type not in AGENTS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown agent type")
    return StreamingResponse(
        stream_run(settings, agent_type=agent_type, task=req.task),
        media_type="text/event-stream",
    )


@router.get("/runs/{run_id}")
async def get_run(
    run_id: str,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    workspace_id = require_workspace(principal)
    res = await session.execute(
        select(AgentRun).where(
            AgentRun.id == uuid.UUID(run_id),
            AgentRun.workspace_id == uuid.UUID(workspace_id),
        )
    )
    agent_run = res.scalar_one_or_none()
    if agent_run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")

    steps_res = await session.execute(
        select(AgentStep)
        .where(AgentStep.agent_run_id == agent_run.id)
        .order_by(AgentStep.step_index)
    )
    return {
        "runId": str(agent_run.id),
        "agentType": agent_run.agent_type,
        "status": agent_run.status,
        "output": (agent_run.output or {}).get("result", ""),
        "totalTokens": agent_run.total_tokens,
        "steps": [
            {"stepIndex": s.step_index, "node": s.node, "type": s.type, "tokens": s.tokens}
            for s in steps_res.scalars().all()
        ],
    }
