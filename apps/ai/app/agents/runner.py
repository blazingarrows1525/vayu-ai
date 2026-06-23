"""Execute the agent graph — persisting runs + steps, or streaming progress."""

from __future__ import annotations

import datetime
import json
import uuid
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.graph import build_agent_graph
from app.agents.registry import AGENTS
from app.core.config import Settings
from app.db.models import AgentRun, AgentStep
from app.services.llm import AnthropicProvider, LLMUnavailable, resolve_llm


def _provider(settings: Settings):
    """Preferred provider with failover; unavailable falls back so nodes degrade per-step."""
    try:
        return resolve_llm(settings)
    except LLMUnavailable:
        return AnthropicProvider(settings)


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


async def run_and_persist(
    session: AsyncSession,
    settings: Settings,
    *,
    agent_type: str,
    task: str,
    user_id: str,
    workspace_id: str,
) -> tuple[AgentRun, list[dict]]:
    config = AGENTS[agent_type]
    graph = build_agent_graph(_provider(settings), config)

    agent_run = AgentRun(
        workspace_id=uuid.UUID(workspace_id),
        user_id=uuid.UUID(user_id),
        agent_type=agent_type,
        input={"task": task},
        status="running",
        started_at=_now(),
    )
    session.add(agent_run)
    await session.flush()

    final = await graph.ainvoke({"task": task})
    steps = final.get("steps", [])
    for index, step in enumerate(steps):
        session.add(
            AgentStep(
                agent_run_id=agent_run.id,
                step_index=index,
                node=step["node"],
                type=step["type"],
                output={"text": step.get("output", "")},
                tokens=step.get("tokens", 0),
            )
        )

    agent_run.status = "succeeded"
    agent_run.output = {"result": final.get("output", "")}
    agent_run.total_tokens = final.get("tokens", 0)
    agent_run.finished_at = _now()
    await session.commit()
    return agent_run, steps


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def stream_run(
    settings: Settings, *, agent_type: str, task: str
) -> AsyncIterator[str]:
    """Live per-node progress via LangGraph's astream (no persistence)."""
    config = AGENTS[agent_type]
    graph = build_agent_graph(_provider(settings), config)

    yield _sse("start", {"agent": agent_type})
    async for event in graph.astream({"task": task}):
        for node, update in event.items():
            snippet = (
                update.get("output")
                or update.get("findings")
                or update.get("plan")
                or ""
            )
            yield _sse(
                "step",
                {"node": node, "output": snippet[:800], "tokens": update.get("tokens", 0)},
            )
    yield _sse("done", {})
