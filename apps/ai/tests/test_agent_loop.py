"""The ReAct agent loop + tools: bounded calculator, tool rounds cap, provider-native
content round-tripping, Anthropic message/tool conversion, and failure reporting."""

import json

import anthropic
import pytest

import app.agents.runner as runner
from app.agents.graph import MAX_TOOL_ROUNDS, build_agent_graph
from app.agents.registry import AGENTS
from app.agents.tools import calculator, get_tools_dict
from app.core.config import Settings
from app.services.llm import (
    AnthropicProvider,
    ChatTurn,
    Usage,
    _to_anthropic_messages,
    _to_anthropic_tool,
)

_USAGE = Usage(10, 5, 0.0, "fake", "fake")


# ── calculator ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "expr, expected",
    [("2 + 2", "4"), ("(5 * 4) / 2", "10.0"), ("2 ** 10", "1024"), ("-3 ** 2", "-9"),
     ("7 // 2", "3"), ("7 % 3", "1")],
)
def test_calculator_arithmetic(expr: str, expected: str) -> None:
    assert calculator(expr) == expected


@pytest.mark.parametrize(
    "expr",
    ["9**9**9**9", "(10**99)*(10**99)", "1e308*10", "(-8) ** 0.5", "1/0",
     "__import__('os').system('id')", "().__class__", "True + 1", "x" * 600],
)
def test_calculator_rejects_unsafe_or_unbounded(expr: str) -> None:
    assert calculator(expr).startswith("Calculator error")


# ── ReAct loop ────────────────────────────────────────────────────────────────

class _ScriptedProvider:
    """Replays a list of ChatTurns and records the messages each call saw."""

    provider = "fake"

    def __init__(self, turns: list[ChatTurn]) -> None:
        self._turns = turns
        self.calls: list[list[dict]] = []

    async def chat(self, *, messages, model=None, max_tokens=1024, tools=None) -> ChatTurn:
        self.calls.append(list(messages))
        return self._turns[min(len(self.calls), len(self._turns)) - 1]


def _calc_call(call_id: str = "c1") -> ChatTurn:
    return ChatTurn(
        "", _USAGE,
        [{"id": call_id, "name": "calculator", "arguments": json.dumps({"expression": "6*7"})}],
        provider_content=[{"type": "thinking", "thinking": "", "signature": "sig"},
                          {"type": "tool_use", "id": call_id, "name": "calculator",
                           "input": {"expression": "6*7"}}],
    )


async def test_react_runs_tool_then_answers() -> None:
    provider = _ScriptedProvider([_calc_call(), ChatTurn("The answer is 42.", _USAGE)])
    final = await build_agent_graph(provider, AGENTS["research"]).ainvoke({"task": "6*7?"})

    assert final["output"] == "The answer is 42."
    assert [s["node"] for s in final["steps"]] == ["agent", "tools", "agent"]
    second_call = provider.calls[1]
    tool_msg = second_call[-1]
    assert tool_msg["role"] == "tool" and tool_msg["content"] == "42"
    # Provider-native content (e.g. Anthropic thinking blocks) is carried to the next turn.
    assert second_call[-2]["provider_content"][0]["type"] == "thinking"


async def test_react_stops_after_max_tool_rounds() -> None:
    provider = _ScriptedProvider([_calc_call()])  # never gives a final answer
    final = await build_agent_graph(provider, AGENTS["research"]).ainvoke({"task": "loop"})

    assert f"Stopped after {MAX_TOOL_ROUNDS} tool rounds" in final["output"]
    assert final["tool_rounds"] == MAX_TOOL_ROUNDS
    assert len(provider.calls) == MAX_TOOL_ROUNDS + 1


class _ExplodingProvider:
    provider = "fake"

    async def chat(self, **_kw) -> ChatTurn:
        raise RuntimeError("upstream 500")


async def test_stream_emits_error_frame_on_failure(monkeypatch) -> None:
    monkeypatch.setattr(runner, "_provider", lambda _settings: _ExplodingProvider())
    frames = [f async for f in runner.stream_run(Settings(_env_file=None), agent_type="research", task="x")]
    assert any('"node": "error"' in f for f in frames)
    assert frames[-1].startswith("event: done")


# ── Anthropic conversion ──────────────────────────────────────────────────────

def test_to_anthropic_tool_maps_parameters() -> None:
    tool = _to_anthropic_tool(get_tools_dict()[1])
    assert tool["name"] == "calculator"
    assert tool["input_schema"]["required"] == ["expression"]


def test_to_anthropic_messages_shapes_history() -> None:
    raw = [{"type": "text", "text": "verbatim"}]
    system, msgs = _to_anthropic_messages([
        {"role": "system", "content": "be brief"},
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "", "tool_calls": [
            {"id": "a", "type": "function", "function": {"name": "calculator", "arguments": '{"expression": "1+1"}'}},
            {"id": "b", "type": "function", "function": {"name": "calculator", "arguments": "not json"}},
        ]},
        {"role": "tool", "tool_call_id": "a", "name": "calculator", "content": "2"},
        {"role": "tool", "tool_call_id": "b", "name": "calculator", "content": "err"},
        {"role": "assistant", "content": "ignored", "provider_content": raw},
    ])

    assert system == "be brief"
    assert [m["role"] for m in msgs] == ["user", "assistant", "user", "assistant"]
    tool_uses = msgs[1]["content"]
    assert tool_uses[0] == {"type": "tool_use", "id": "a", "name": "calculator", "input": {"expression": "1+1"}}
    assert tool_uses[1]["input"] == {}  # malformed arguments degrade to empty input
    # Both results batched into ONE user turn.
    assert [b["tool_use_id"] for b in msgs[2]["content"]] == ["a", "b"]
    assert msgs[3]["content"] is raw  # provider-native content replayed verbatim


class _FakeMessages:
    def __init__(self, message: anthropic.types.Message) -> None:
        self._message = message
        self.kwargs: dict = {}

    async def create(self, **kwargs) -> anthropic.types.Message:
        self.kwargs = kwargs
        return self._message


def _anthropic_provider(stop_reason: str, content: list[dict]) -> tuple[AnthropicProvider, _FakeMessages]:
    message = anthropic.types.Message.model_validate({
        "id": "msg_1", "type": "message", "role": "assistant", "model": "claude-test",
        "content": content, "stop_reason": stop_reason, "stop_sequence": None,
        "usage": {"input_tokens": 12, "output_tokens": 7},
    })
    provider = AnthropicProvider(Settings(_env_file=None, anthropic_api_key="sk-ant-test"))
    fake = _FakeMessages(message)
    provider._client = type("C", (), {"messages": fake})()  # type: ignore[assignment]
    return provider, fake


async def test_anthropic_chat_returns_tool_calls_and_raw_content() -> None:
    provider, fake = _anthropic_provider("tool_use", [
        {"type": "text", "text": "Let me compute."},
        {"type": "tool_use", "id": "toolu_1", "name": "calculator", "input": {"expression": "6*7"}},
    ])
    turn = await provider.chat(
        messages=[{"role": "system", "content": "sys"}, {"role": "user", "content": "6*7?"}],
        tools=get_tools_dict(),
    )

    assert fake.kwargs["system"] == "sys"
    assert fake.kwargs["tools"][1]["name"] == "calculator"
    assert turn.text == "Let me compute."
    assert turn.tool_calls == [
        {"id": "toolu_1", "name": "calculator", "arguments": json.dumps({"expression": "6*7"})}
    ]
    assert turn.provider_content is not None
    assert turn.provider_content[1]["type"] == "tool_use"
    assert turn.usage.input_tokens == 12 and turn.usage.provider == "anthropic"


async def test_anthropic_chat_ignores_truncated_tool_use() -> None:
    provider, _ = _anthropic_provider("max_tokens", [
        {"type": "tool_use", "id": "toolu_1", "name": "calculator", "input": {}},
    ])
    turn = await provider.chat(messages=[{"role": "user", "content": "x"}], tools=get_tools_dict())
    assert turn.tool_calls is None
