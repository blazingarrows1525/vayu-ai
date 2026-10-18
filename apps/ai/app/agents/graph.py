"""The agent graph: a ReAct LangGraph state machine.
The agent decides to use tools or returns a final answer."""

from __future__ import annotations

import asyncio
import operator
from typing import Annotated, Any, TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents.registry import AgentConfig
from app.agents.tools import execute_tool, get_tools_dict
from app.services.llm import LLMUnavailable

# Each round is one agent → tools hop; the cap bounds cost and keeps the graph well
# under LangGraph's default recursion limit (25 super-steps).
MAX_TOOL_ROUNDS = 6


class AgentState(TypedDict, total=False):
    task: str
    messages: Annotated[list[dict], operator.add]
    output: str
    steps: Annotated[list[dict], operator.add]
    tokens: Annotated[int, operator.add]
    tool_rounds: Annotated[int, operator.add]


def build_agent_graph(provider: Any, config: AgentConfig):
    is_tool_capable = hasattr(provider, "chat")

    async def agent_node(state: AgentState) -> dict:
        msgs_to_append = []
        msgs = state.get("messages", [])
        if not msgs:
            sys = config.system + "\n\nYou have access to tools. Use them if necessary to answer the user's request. When you are done, return the final answer."
            msgs_to_append = [
                {"role": "system", "content": sys},
                {"role": "user", "content": state["task"]}
            ]
            # Since msgs was empty, we need to pass these to the LLM now
            msgs = msgs_to_append.copy()

        if not is_tool_capable:
            # Fallback for providers that don't support tools yet
            prompt = state["task"]
            try:
                text, usage = await provider.complete(system=config.system, prompt=prompt, max_tokens=2048)
                return {
                    "output": text,
                    "tokens": usage.input_tokens + usage.output_tokens,
                    "steps": [{"node": "agent", "type": "llm", "output": text, "tokens": usage.input_tokens + usage.output_tokens}],
                }
            except LLMUnavailable:
                return {"output": "LLM Unavailable"}

        try:
            turn = await provider.chat(
                messages=msgs, tools=get_tools_dict(), max_tokens=2048
            )
        except LLMUnavailable:
            return {"output": "LLM Unavailable"}

        assistant_msg: dict[str, Any] = {"role": "assistant", "content": turn.text or ""}
        if turn.tool_calls:
            assistant_msg["tool_calls"] = [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {"name": tc["name"], "arguments": tc["arguments"]}
                } for tc in turn.tool_calls
            ]
        if turn.provider_content is not None:
            assistant_msg["provider_content"] = turn.provider_content

        msgs_to_append.append(assistant_msg)
        tokens = turn.usage.input_tokens + turn.usage.output_tokens

        return {
            "messages": msgs_to_append,
            "output": turn.text or "",
            "tokens": tokens,
            "steps": [{"node": "agent", "type": "llm", "output": turn.text or f"Requested tools: {len(turn.tool_calls or [])}", "tokens": tokens}],
        }

    async def tools_node(state: AgentState) -> dict:
        tool_calls = state["messages"][-1].get("tool_calls", [])

        # Tools do blocking I/O / CPU work — run them in threads, concurrently.
        results = await asyncio.gather(*(
            asyncio.to_thread(execute_tool, tc["function"]["name"], tc["function"]["arguments"])
            for tc in tool_calls
        ))

        msgs_to_append = []
        step_outputs = []
        for tc, result in zip(tool_calls, results, strict=True):
            t_name = tc["function"]["name"]
            msgs_to_append.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "name": t_name,
                "content": result
            })
            step_outputs.append(f"[{t_name}] -> {result[:200]}...")

        return {
            "messages": msgs_to_append,
            "tool_rounds": 1,
            "steps": [{"node": "tools", "type": "tool", "output": "\n".join(step_outputs), "tokens": 0}],
        }

    async def give_up_node(state: AgentState) -> dict:
        note = f"Stopped after {MAX_TOOL_ROUNDS} tool rounds without a final answer."
        partial = (state.get("output") or "").strip()
        return {
            "output": f"{partial}\n\n{note}" if partial else note,
            "steps": [{"node": "agent", "type": "limit", "output": note, "tokens": 0}],
        }

    def should_continue(state: AgentState) -> str:
        if not is_tool_capable:
            return END
        msgs = state.get("messages", [])
        if not msgs:
            return END
        last_msg = msgs[-1]
        if last_msg.get("tool_calls"):
            if state.get("tool_rounds", 0) >= MAX_TOOL_ROUNDS:
                return "give_up"
            return "tools"
        return END

    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tools_node)
    graph.add_node("give_up", give_up_node)
    graph.add_edge(START, "agent")
    graph.add_conditional_edges(
        "agent", should_continue, {"tools": "tools", "give_up": "give_up", END: END}
    )
    graph.add_edge("tools", "agent")
    graph.add_edge("give_up", END)
    return graph.compile()
