"""Unified multi-provider LLM layer.

A single streaming/completion contract across providers: Anthropic (native SDK) and the
OpenAI-compatible family — OpenAI, Gemini (OpenAI-compat endpoint), Groq, OpenRouter — via the
`openai` SDK with per-provider base URLs. `resolve_llm()` picks the preferred provider and fails
over to the next configured one. Token + cost are tracked on every call.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Protocol

import anthropic
from openai import AsyncOpenAI

from app.core.config import Settings

# USD per 1M tokens: (input, output).
_PRICING: dict[str, tuple[float, float]] = {
    # Anthropic
    "claude-opus-4-8": (5.0, 25.0),
    "claude-opus-4-7": (5.0, 25.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
    "anthropic/claude-3.5-sonnet": (3.0, 15.0),
    # OpenAI
    "gpt-4o": (2.5, 10.0),
    "gpt-4o-mini": (0.15, 0.6),
    "gpt-4.1-mini": (0.4, 1.6),
    # Gemini
    "gemini-2.0-flash": (0.1, 0.4),
    "gemini-1.5-pro": (1.25, 5.0),
    # Groq (OSS models, hosted)
    "llama-3.3-70b-versatile": (0.59, 0.79),
}
_DEFAULT_PRICE = (1.0, 3.0)


@dataclass(slots=True)
class Usage:
    input_tokens: int
    output_tokens: int
    cost_usd: float
    model: str
    provider: str


class LLMUnavailable(RuntimeError):
    """Raised when no provider credential is configured."""


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    rate_in, rate_out = _PRICING.get(model, _DEFAULT_PRICE)
    return round(input_tokens * rate_in / 1e6 + output_tokens * rate_out / 1e6, 6)


def _approx_tokens(text: str) -> int:
    return max(1, len(text) // 4)


class LLMProvider(Protocol):
    provider: str

    @property
    def available(self) -> bool: ...

    def stream(
        self, *, system: str, prompt: str, model: str | None = ..., max_tokens: int = ...
    ) -> AsyncIterator[tuple[str, str | Usage]]: ...

    async def complete(
        self, *, system: str, prompt: str, model: str | None = ..., max_tokens: int = ...
    ) -> tuple[str, Usage]: ...


class AnthropicProvider:
    provider = "anthropic"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = (
            anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
            if settings.anthropic_api_key
            else None
        )

    @property
    def available(self) -> bool:
        return self._client is not None

    async def stream(
        self, *, system: str, prompt: str, model: str | None = None, max_tokens: int = 4096
    ) -> AsyncIterator[tuple[str, str | Usage]]:
        if self._client is None:
            raise LLMUnavailable("ANTHROPIC_API_KEY is not configured")
        mdl = model or self._settings.default_chat_model
        async with self._client.messages.stream(
            model=mdl,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                yield ("token", text)
            final = await stream.get_final_message()
        yield (
            "usage",
            Usage(
                final.usage.input_tokens,
                final.usage.output_tokens,
                estimate_cost(mdl, final.usage.input_tokens, final.usage.output_tokens),
                mdl,
                self.provider,
            ),
        )

    async def complete(
        self, *, system: str, prompt: str, model: str | None = None, max_tokens: int = 1024
    ) -> tuple[str, Usage]:
        if self._client is None:
            raise LLMUnavailable("ANTHROPIC_API_KEY is not configured")
        mdl = model or self._settings.default_chat_model
        msg = await self._client.messages.create(
            model=mdl,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(b.text for b in msg.content if b.type == "text")
        return text, Usage(
            msg.usage.input_tokens,
            msg.usage.output_tokens,
            estimate_cost(mdl, msg.usage.input_tokens, msg.usage.output_tokens),
            mdl,
            self.provider,
        )


class OpenAICompatibleProvider:
    """OpenAI, Gemini (OpenAI-compat), Groq, OpenRouter — same wire format, different base URL."""

    def __init__(
        self, *, provider: str, api_key: str | None, base_url: str | None, default_model: str
    ) -> None:
        self.provider = provider
        self._default_model = default_model
        self._client = (
            AsyncOpenAI(api_key=api_key, base_url=base_url) if api_key else None
        )

    @property
    def available(self) -> bool:
        return self._client is not None

    def _messages(self, system: str, prompt: str) -> list[dict]:
        return [{"role": "system", "content": system}, {"role": "user", "content": prompt}]

    async def stream(
        self, *, system: str, prompt: str, model: str | None = None, max_tokens: int = 4096
    ) -> AsyncIterator[tuple[str, str | Usage]]:
        if self._client is None:
            raise LLMUnavailable(f"{self.provider} API key is not configured")
        mdl = model or self._default_model
        parts: list[str] = []
        in_tok = out_tok = 0
        stream = await self._client.chat.completions.create(
            model=mdl,
            max_tokens=max_tokens,
            messages=self._messages(system, prompt),
            stream=True,
            stream_options={"include_usage": True},
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                token = chunk.choices[0].delta.content
                parts.append(token)
                yield ("token", token)
            if getattr(chunk, "usage", None):
                in_tok = chunk.usage.prompt_tokens
                out_tok = chunk.usage.completion_tokens
        if not out_tok:  # provider omitted usage on the stream
            in_tok = _approx_tokens(system + prompt)
            out_tok = _approx_tokens("".join(parts))
        yield (
            "usage",
            Usage(in_tok, out_tok, estimate_cost(mdl, in_tok, out_tok), mdl, self.provider),
        )

    async def complete(
        self, *, system: str, prompt: str, model: str | None = None, max_tokens: int = 1024
    ) -> tuple[str, Usage]:
        if self._client is None:
            raise LLMUnavailable(f"{self.provider} API key is not configured")
        mdl = model or self._default_model
        resp = await self._client.chat.completions.create(
            model=mdl, max_tokens=max_tokens, messages=self._messages(system, prompt)
        )
        text = resp.choices[0].message.content or ""
        usage = resp.usage
        in_tok = usage.prompt_tokens if usage else _approx_tokens(system + prompt)
        out_tok = usage.completion_tokens if usage else _approx_tokens(text)
        return text, Usage(in_tok, out_tok, estimate_cost(mdl, in_tok, out_tok), mdl, self.provider)


# Preference order for failover when the requested/default provider isn't configured.
PROVIDER_ORDER = ["anthropic", "openai", "gemini", "groq", "openrouter"]


def build_provider(name: str, settings: Settings) -> LLMProvider:
    if name == "anthropic":
        return AnthropicProvider(settings)
    if name == "openai":
        return OpenAICompatibleProvider(
            provider="openai",
            api_key=settings.openai_api_key,
            base_url=None,
            default_model=settings.openai_chat_model,
        )
    if name == "gemini":
        return OpenAICompatibleProvider(
            provider="gemini",
            api_key=settings.gemini_api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            default_model=settings.gemini_chat_model,
        )
    if name == "groq":
        return OpenAICompatibleProvider(
            provider="groq",
            api_key=settings.groq_api_key,
            base_url="https://api.groq.com/openai/v1",
            default_model=settings.groq_chat_model,
        )
    if name == "openrouter":
        return OpenAICompatibleProvider(
            provider="openrouter",
            api_key=settings.openrouter_api_key,
            base_url="https://openrouter.ai/api/v1",
            default_model=settings.openrouter_chat_model,
        )
    raise LLMUnavailable(f"unknown provider: {name}")


def provider_status(settings: Settings) -> list[dict]:
    """Configured/available state for every provider (for /v1/providers + UI)."""
    out: list[dict] = []
    for name in PROVIDER_ORDER:
        out.append({"provider": name, "available": build_provider(name, settings).available})
    return out


def resolve_llm(settings: Settings, preferred: str | None = None) -> LLMProvider:
    """First available provider, trying preferred → default → the rest. Enables both
    provider switching (preferred) and failover (skip unconfigured)."""
    order: list[str] = []
    for name in [preferred, settings.default_llm_provider, *PROVIDER_ORDER]:
        if name and name not in order:
            order.append(name)
    for name in order:
        try:
            provider = build_provider(name, settings)
        except LLMUnavailable:
            continue
        if provider.available:
            return provider
    raise LLMUnavailable("no LLM provider is configured")
