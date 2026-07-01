"""Multi-provider LLM orchestration: JSON extraction, resolution order, and cross-provider
fallback for complete / structured / streaming — all exercised without any network."""

import pytest

import app.services.llm as llm
from app.core.config import Settings
from app.services.llm import (
    Usage,
    _extract_json,
    _resolve_chain,
    _resolve_order,
    estimate_cost,
)

_NO_KEYS = dict(
    anthropic_api_key=None,
    openai_api_key=None,
    gemini_api_key=None,
    groq_api_key=None,
    openrouter_api_key=None,
)


def test_extract_json_bare() -> None:
    assert _extract_json('{"a": 1}') == {"a": 1}


def test_extract_json_fenced() -> None:
    assert _extract_json('```json\n{"a": 1}\n```') == {"a": 1}


def test_extract_json_prose_wrapped() -> None:
    assert _extract_json('Sure! Here: {"a": 1, "b": [2, 3]} — done') == {"a": 1, "b": [2, 3]}


def test_resolve_order_dedup_and_priority() -> None:
    settings = Settings(**{**_NO_KEYS, "default_llm_provider": "gemini"})
    order = _resolve_order(settings, preferred="groq")
    assert order[0] == "groq" and order[1] == "gemini"
    assert len(order) == len(set(order))  # no duplicates


def test_resolve_chain_empty_without_keys() -> None:
    assert _resolve_chain(Settings(**_NO_KEYS)) == []


def test_gemini_pro_pricing_known() -> None:
    assert estimate_cost("gemini-2.5-pro", 1_000_000, 1_000_000) == round(1.25 + 10.0, 6)


class _Fake:
    """A provider double: succeeds or raises, no network."""

    def __init__(self, name: str, *, fail: bool = False, text: str = "ok") -> None:
        self.provider = name
        self._fail = fail
        self._text = text

    @property
    def available(self) -> bool:
        return True

    async def complete(self, *, system, prompt, model=None, max_tokens=1024):
        if self._fail:
            raise RuntimeError(f"{self.provider} boom")
        return self._text, Usage(1, 1, 0.0, model or "m", self.provider)

    async def complete_structured(self, *, system, prompt, model=None, max_tokens=1024):
        if self._fail:
            raise RuntimeError(f"{self.provider} boom")
        return {"provider": self.provider}, Usage(1, 1, 0.0, model or "m", self.provider)

    async def stream(self, *, system, prompt, model=None, max_tokens=4096):
        if self._fail:
            raise RuntimeError(f"{self.provider} boom")
        yield ("token", self._text)
        yield ("usage", Usage(1, 1, 0.0, model or "m", self.provider))


async def test_generate_falls_over_to_next_provider(monkeypatch) -> None:
    monkeypatch.setattr(
        llm,
        "_resolve_chain",
        lambda settings, preferred=None: [_Fake("gemini", fail=True), _Fake("groq", text="done")],
    )
    text, usage = await llm.generate(Settings(**_NO_KEYS), system="s", prompt="p")
    assert text == "done"
    assert usage.provider == "groq"


async def test_generate_raises_llmerror_when_all_fail(monkeypatch) -> None:
    monkeypatch.setattr(
        llm,
        "_resolve_chain",
        lambda settings, preferred=None: [_Fake("a", fail=True), _Fake("b", fail=True)],
    )
    with pytest.raises(llm.LLMError):
        await llm.generate(Settings(**_NO_KEYS), system="s", prompt="p")


async def test_generate_raises_unavailable_when_no_providers(monkeypatch) -> None:
    monkeypatch.setattr(llm, "_resolve_chain", lambda settings, preferred=None: [])
    with pytest.raises(llm.LLMUnavailable):
        await llm.generate(Settings(**_NO_KEYS), system="s", prompt="p")


async def test_generate_json_falls_over(monkeypatch) -> None:
    monkeypatch.setattr(
        llm,
        "_resolve_chain",
        lambda settings, preferred=None: [_Fake("gemini", fail=True), _Fake("groq")],
    )
    data, _ = await llm.generate_json(Settings(**_NO_KEYS), system="s", prompt="p")
    assert data == {"provider": "groq"}


async def test_stream_generate_falls_over_before_first_token(monkeypatch) -> None:
    monkeypatch.setattr(
        llm,
        "_resolve_chain",
        lambda settings, preferred=None: [_Fake("gemini", fail=True), _Fake("groq", text="hi")],
    )
    tokens = [
        payload
        async for kind, payload in llm.stream_generate(Settings(**_NO_KEYS), system="s", prompt="p")
        if kind == "token"
    ]
    assert tokens == ["hi"]
