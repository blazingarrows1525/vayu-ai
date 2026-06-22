"""The agent graph: a LangGraph state machine (plan → research → synthesize).
Each node calls the model and appends a checkpointed step to the state."""

from __future__ import annotations

import operator
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents.registry import AgentConfig
from app.services.llm import AnthropicProvider, LLMUnavailable


class AgentState(TypedDict, total=False):
    task: str
    plan: str
    findings: str
    output: str
    steps: Annotated[list[dict], operator.add]
    tokens: Annotated[int, operator.add]


async def _call(
    provider: AnthropicProvider, system: str, prompt: str, max_tokens: int = 1024
) -> tuple[str, int]:
    try:
        text, usage = await provider.complete(
            system=system, prompt=prompt, max_tokens=max_tokens
        )
        return text, usage.input_tokens + usage.output_tokens
    except LLMUnavailable:
        return "(model not configured — set ANTHROPIC_API_KEY)", 0


def build_agent_graph(provider: AnthropicProvider, config: AgentConfig):
    async def plan(state: AgentState) -> dict:
        text, tokens = await _call(
            provider,
            f"{config.system} Produce a short numbered plan to accomplish the task.",
            f"Task: {state['task']}",
            max_tokens=512,
        )
        return {
            "plan": text,
            "tokens": tokens,
            "steps": [{"node": "plan", "type": "llm", "output": text, "tokens": tokens}],
        }

    async def research(state: AgentState) -> dict:
        text, tokens = await _call(
            provider,
            f"{config.system} Gather the key facts, considerations, and structure needed.",
            f"Task: {state['task']}\n\nPlan:\n{state.get('plan', '')}",
            max_tokens=1024,
        )
        return {
            "findings": text,
            "tokens": tokens,
            "steps": [
                {"node": "research", "type": "tool", "output": text, "tokens": tokens}
            ],
        }

    async def synthesize(state: AgentState) -> dict:
        text, tokens = await _call(
            provider,
            f"{config.system} Produce the final deliverable using the plan and findings.",
            f"Task: {state['task']}\n\nPlan:\n{state.get('plan', '')}\n\nFindings:\n{state.get('findings', '')}",
            max_tokens=2048,
        )
        return {
            "output": text,
            "tokens": tokens,
            "steps": [
                {"node": "synthesize", "type": "llm", "output": text, "tokens": tokens}
            ],
        }

    graph = StateGraph(AgentState)
    graph.add_node("plan", plan)
    graph.add_node("research", research)
    graph.add_node("synthesize", synthesize)
    graph.add_edge(START, "plan")
    graph.add_edge("plan", "research")
    graph.add_edge("research", "synthesize")
    graph.add_edge("synthesize", END)
    return graph.compile()
