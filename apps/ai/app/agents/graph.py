"""The agent graph: a ReAct LangGraph state machine.
The agent decides to use tools or returns a final answer."""

from __future__ import annotations

import operator
from typing import Annotated, TypedDict, Any

from langgraph.graph import END, START, StateGraph

from app.agents.registry import AgentConfig
from app.agents.tools import execute_tool, get_tools_dict
from app.services.llm import LLMUnavailable


class AgentState(TypedDict, total=False):
    task: str
    messages: Annotated[list[dict], operator.add]
    output: str
    steps: Annotated[list[dict], operator.add]
    tokens: Annotated[int, operator.add]


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
            text, usage, tool_calls = await provider.chat(
                messages=msgs, tools=get_tools_dict(), max_tokens=2048
            )
            assistant_msg: dict[str, Any] = {"role": "assistant", "content": text or ""}
            
            if tool_calls:
                assistant_msg["tool_calls"] = [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {"name": tc["name"], "arguments": tc["arguments"]}
                    } for tc in tool_calls
                ]
                
            msgs_to_append.append(assistant_msg)
            
            return {
                "messages": msgs_to_append,
                "output": text or "",
                "tokens": usage.input_tokens + usage.output_tokens,
                "steps": [{"node": "agent", "type": "llm", "output": text or f"Requested tools: {len(tool_calls or [])}", "tokens": usage.input_tokens + usage.output_tokens}],
            }
        except LLMUnavailable:
            return {"output": "LLM Unavailable"}

    async def tools_node(state: AgentState) -> dict:
        last_msg = state["messages"][-1]
        tool_calls = last_msg.get("tool_calls", [])
        
        msgs_to_append = []
        step_outputs = []
        
        for tc in tool_calls:
            t_name = tc["function"]["name"]
            t_args = tc["function"]["arguments"]
            result = execute_tool(t_name, t_args)
            
            msgs_to_append.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "name": t_name,
                "content": result
            })
            step_outputs.append(f"[{t_name}] -> {result[:200]}...")
            
        return {
            "messages": msgs_to_append,
            "steps": [{"node": "tools", "type": "tool", "output": "\n".join(step_outputs), "tokens": 0}],
        }

    def should_continue(state: AgentState) -> str:
        if not is_tool_capable:
            return END
        msgs = state.get("messages", [])
        if not msgs:
            return END
        last_msg = msgs[-1]
        if last_msg.get("tool_calls"):
            return "tools"
        return END

    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tools_node)
    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")
    return graph.compile()
