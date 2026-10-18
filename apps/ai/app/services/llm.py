"""Unified multi-provider LLM layer.

A single streaming/completion contract across providers: Anthropic (native SDK) and the
OpenAI-compatible family — OpenAI, Gemini (OpenAI-compat endpoint), Groq, OpenRouter — via the
`openai` SDK with per-provider base URLs.

Robustness is layered:
  • transient errors (429 / 5xx / timeouts) are retried with backoff by each SDK client
    (`max_retries`);
  • `generate()` / `generate_json()` / `stream_generate()` add cross-provider *fallback* —
    if the preferred provider errors, the next configured one is tried;
  • `complete_structured()` / `generate_json()` return parsed JSON for structured output.

Token + cost are tracked on every call. Every symbol the rest of the app imports
(`resolve_llm`, `provider_status`, `AnthropicProvider`, `Usage`, `LLMUnavailable`, …) is
preserved.
"""

from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Protocol

import anthropic
import openai
import structlog
from openai import AsyncOpenAI

from app.core.config import Settings

log = structlog.get_logger(__name__)

# USD per 1M tokens: (input, output). Approximate list-prices for cost estimation.
_PRICING: dict[str, tuple[float, float]] = {
    # Anthropic
    "claude-opus-5-5": (4.0, 20.0),
    "claude-opus-5": (5.0, 25.0),
    "claude-sonnet-5-5": (2.0, 10.0),
    "claude-sonnet-5": (2.0, 10.0),
    "claude-haiku-5-5": (0.10, 0.50),
    "claude-opus-4-8": (5.0, 25.0),
    "claude-opus-4-7": (5.0, 25.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
    "anthropic/claude-3.5-sonnet": (3.0, 15.0),
    # OpenAI
    "gpt-4o": (2.5, 10.0),
    "gpt-4o-mini": (0.15, 0.6),
    "gpt-4.1": (2.0, 8.0),
    "gpt-4.1-mini": (0.4, 1.6),
    # Gemini
    "gemini-2.5-pro": (1.25, 10.0),
    "gemini-2.5-flash": (0.30, 2.50),
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


@dataclass(slots=True)
class ChatTurn:
    """One tool-capable chat completion. `tool_calls` items are
    `{"id", "name", "arguments"}` (arguments = JSON string). `provider_content` is the
    provider's raw assistant content, replayed verbatim on the next turn when the
    provider needs it (Anthropic thinking blocks must round-trip unchanged)."""

    text: str
    usage: Usage
    tool_calls: list[dict] | None = None
    provider_content: list[dict] | None = None


class LLMUnavailable(RuntimeError):
    """Raised when no provider credential is configured."""


class LLMError(RuntimeError):
    """Raised when every configured provider errored on a request."""


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    rate_in, rate_out = _PRICING.get(model, _DEFAULT_PRICE)
    return round(input_tokens * rate_in / 1e6 + output_tokens * rate_out / 1e6, 6)


def _approx_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def _extract_json(text: str) -> dict:
    """Best-effort parse of a JSON object from model output (tolerates code fences/prose)."""
    s = text.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*|\s*```$", "", s, flags=re.IGNORECASE).strip()
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        start, end = s.find("{"), s.rfind("}")
        if start != -1 and end > start:
            return json.loads(s[start : end + 1])
        raise


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

    async def complete_structured(
        self, *, system: str, prompt: str, model: str | None = ..., max_tokens: int = ...
    ) -> tuple[dict, Usage]: ...

    async def chat(
        self, *, messages: list[dict], model: str | None = ..., max_tokens: int = ..., tools: list[dict] | None = ...
    ) -> ChatTurn: ...


def _to_anthropic_tool(tool: dict) -> dict:
    """OpenAI `{"type": "function", "function": {...}}` → Anthropic tool definition."""
    fn = tool["function"]
    return {
        "name": fn["name"],
        "description": fn.get("description", ""),
        "input_schema": fn.get("parameters") or {"type": "object", "properties": {}},
    }


def _to_anthropic_messages(messages: list[dict]) -> tuple[str, list[dict]]:
    """OpenAI-style chat history → (system, Anthropic messages). Assistant turns this
    provider produced are replayed verbatim via `provider_content`; consecutive tool
    results are batched into a single user turn, as the Messages API expects."""
    system_parts: list[str] = []
    out: list[dict] = []
    for m in messages:
        role = m.get("role")
        if role == "system":
            system_parts.append(m.get("content") or "")
        elif role == "tool":
            block = {
                "type": "tool_result",
                "tool_use_id": m["tool_call_id"],
                "content": m.get("content") or "",
            }
            prev = out[-1] if out else None
            if (
                prev is not None
                and prev["role"] == "user"
                and isinstance(prev["content"], list)
                and all(b.get("type") == "tool_result" for b in prev["content"])
            ):
                prev["content"].append(block)
            else:
                out.append({"role": "user", "content": [block]})
        elif role == "assistant":
            content = m.get("provider_content")
            if content is None:
                content = []
                if m.get("content"):
                    content.append({"type": "text", "text": m["content"]})
                for tc in m.get("tool_calls") or []:
                    fn = tc["function"]
                    try:
                        args = json.loads(fn.get("arguments") or "{}")
                    except json.JSONDecodeError:
                        args = {}
                    content.append(
                        {"type": "tool_use", "id": tc["id"], "name": fn["name"], "input": args}
                    )
            out.append({"role": "assistant", "content": content})
        else:
            out.append({"role": "user", "content": m.get("content") or ""})
    return "\n\n".join(p for p in system_parts if p), out


class AnthropicProvider:
    provider = "anthropic"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = (
            anthropic.AsyncAnthropic(
                api_key=settings.anthropic_api_key, max_retries=settings.llm_max_retries
            )
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

    async def complete_structured(
        self, *, system: str, prompt: str, model: str | None = None, max_tokens: int = 1024
    ) -> tuple[dict, Usage]:
        sys = system + "\n\nRespond with a single valid JSON object and nothing else."
        text, usage = await self.complete(
            system=sys, prompt=prompt, model=model, max_tokens=max_tokens
        )
        return _extract_json(text), usage

    async def chat(
        self, *, messages: list[dict], model: str | None = None, max_tokens: int = 1024, tools: list[dict] | None = None
    ) -> ChatTurn:
        if self._client is None:
            raise LLMUnavailable("ANTHROPIC_API_KEY is not configured")
        mdl = model or self._settings.default_chat_model
        system, convo = _to_anthropic_messages(messages)
        kwargs: dict = {}
        if system:
            kwargs["system"] = system
        if tools:
            kwargs["tools"] = [_to_anthropic_tool(t) for t in tools]
        msg = await self._client.messages.create(
            model=mdl, max_tokens=max_tokens, messages=convo, **kwargs  # type: ignore[arg-type]
        )
        text = "".join(b.text for b in msg.content if b.type == "text")
        # Only a completed tool_use turn is runnable — a max_tokens cut can leave partial input.
        tool_calls = None
        if msg.stop_reason == "tool_use":
            tool_calls = [
                {"id": b.id, "name": b.name, "arguments": json.dumps(b.input)}
                for b in msg.content
                if b.type == "tool_use"
            ] or None
        if msg.stop_reason == "refusal" and not text:
            text = "The model declined this request."
        usage = Usage(
            msg.usage.input_tokens,
            msg.usage.output_tokens,
            estimate_cost(mdl, msg.usage.input_tokens, msg.usage.output_tokens),
            mdl,
            self.provider,
        )
        content = [b.model_dump(exclude_none=True) for b in msg.content]
        return ChatTurn(text, usage, tool_calls, content)


class OpenAICompatibleProvider:
    """OpenAI, Gemini (OpenAI-compat), Groq, OpenRouter — same wire format, different base URL."""

    def __init__(
        self,
        *,
        provider: str,
        api_key: str | None,
        base_url: str | None,
        default_model: str,
        max_retries: int = 2,
    ) -> None:
        self.provider = provider
        self._default_model = default_model
        self._client = (
            AsyncOpenAI(api_key=api_key, base_url=base_url, max_retries=max_retries)
            if api_key
            else None
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

    async def complete_structured(
        self, *, system: str, prompt: str, model: str | None = None, max_tokens: int = 1024
    ) -> tuple[dict, Usage]:
        if self._client is None:
            raise LLMUnavailable(f"{self.provider} API key is not configured")
        mdl = model or self._default_model
        sys = system + "\n\nRespond with a single valid JSON object and nothing else."
        msgs = self._messages(sys, prompt)
        try:
            resp = await self._client.chat.completions.create(
                model=mdl,
                max_tokens=max_tokens,
                messages=msgs,
                response_format={"type": "json_object"},
            )
        except (openai.BadRequestError, openai.UnprocessableEntityError):
            # Model/endpoint doesn't support response_format — degrade to plain + parse.
            resp = await self._client.chat.completions.create(
                model=mdl, max_tokens=max_tokens, messages=msgs
            )
        text = resp.choices[0].message.content or ""
        usage = resp.usage
        in_tok = usage.prompt_tokens if usage else _approx_tokens(sys + prompt)
        out_tok = usage.completion_tokens if usage else _approx_tokens(text)
        return _extract_json(text), Usage(
            in_tok, out_tok, estimate_cost(mdl, in_tok, out_tok), mdl, self.provider
        )

    async def chat(
        self, *, messages: list[dict], model: str | None = None, max_tokens: int = 1024, tools: list[dict] | None = None
    ) -> ChatTurn:
        if self._client is None:
            raise LLMUnavailable(f"{self.provider} API key is not configured")
        mdl = model or self._default_model
        kwargs = {}
        if tools:
            kwargs["tools"] = tools
        # provider_content is Anthropic-only state; OpenAI-compatible APIs reject unknown keys.
        wire = [{k: v for k, v in m.items() if k != "provider_content"} for m in messages]

        resp = await self._client.chat.completions.create(
            model=mdl, max_tokens=max_tokens, messages=wire, **kwargs  # type: ignore
        )
        
        msg = resp.choices[0].message
        text = msg.content or ""
        
        tool_calls = None
        if msg.tool_calls:
            tool_calls = []
            for tc in msg.tool_calls:
                tool_calls.append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": tc.function.arguments
                })
                
        usage = resp.usage
        in_tok = usage.prompt_tokens if usage else 0
        out_tok = usage.completion_tokens if usage else 0
        return ChatTurn(
            text, Usage(in_tok, out_tok, estimate_cost(mdl, in_tok, out_tok), mdl, self.provider),
            tool_calls,
        )


# Preference order for failover when the requested/default provider isn't configured.
PROVIDER_ORDER = ["anthropic", "openai", "nvidia", "gemini", "groq", "openrouter"]


def build_provider(name: str, settings: Settings) -> LLMProvider:
    if name == "anthropic":
        return AnthropicProvider(settings)
    if name == "openai":
        return OpenAICompatibleProvider(
            provider="openai",
            api_key=settings.openai_api_key,
            base_url=None,
            default_model=settings.openai_chat_model,
            max_retries=settings.llm_max_retries,
        )
    if name == "gemini":
        return OpenAICompatibleProvider(
            provider="gemini",
            api_key=settings.gemini_api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            default_model=settings.gemini_chat_model,
            max_retries=settings.llm_max_retries,
        )
    if name == "groq":
        return OpenAICompatibleProvider(
            provider="groq",
            api_key=settings.groq_api_key,
            base_url="https://api.groq.com/openai/v1",
            default_model=settings.groq_chat_model,
            max_retries=settings.llm_max_retries,
        )
    if name == "openrouter":
        return OpenAICompatibleProvider(
            provider="openrouter",
            api_key=settings.openrouter_api_key,
            base_url="https://openrouter.ai/api/v1",
            default_model=settings.openrouter_chat_model,
            max_retries=settings.llm_max_retries,
        )
    if name == "nvidia":
        return OpenAICompatibleProvider(
            provider="nvidia",
            api_key=settings.nvidia_api_key,
            base_url=settings.nvidia_base_url,
            default_model=settings.nvidia_default_model,
            max_retries=settings.llm_max_retries,
        )
    raise LLMUnavailable(f"unknown provider: {name}")


def provider_status(settings: Settings) -> list[dict]:
    """Configured/available state for every provider (for /v1/providers + UI)."""
    out: list[dict] = []
    for name in PROVIDER_ORDER:
        out.append({"provider": name, "available": build_provider(name, settings).available})
    return out


def _resolve_order(settings: Settings, preferred: str | None = None) -> list[str]:
    order: list[str] = []
    for name in [preferred, settings.default_llm_provider, *PROVIDER_ORDER]:
        if name and name not in order:
            order.append(name)
    return order


def resolve_llm(settings: Settings, preferred: str | None = None) -> LLMProvider:
    """First available provider, trying preferred → default → the rest. Enables both
    provider switching (preferred) and failover (skip unconfigured)."""
    for name in _resolve_order(settings, preferred):
        try:
            provider = build_provider(name, settings)
        except LLMUnavailable:
            continue
        if provider.available:
            return provider
    raise LLMUnavailable("no LLM provider is configured")


def _resolve_chain(settings: Settings, preferred: str | None = None) -> list[LLMProvider]:
    """All *available* providers in preference order — the fallback chain."""
    chain: list[LLMProvider] = []
    for name in _resolve_order(settings, preferred):
        try:
            provider = build_provider(name, settings)
        except LLMUnavailable:
            continue
        if provider.available:
            chain.append(provider)
    return chain


async def generate(
    settings: Settings,
    *,
    system: str,
    prompt: str,
    preferred: str | None = None,
    model: str | None = None,
    max_tokens: int = 1024,
) -> tuple[str, Usage]:
    """Complete with cross-provider fallback. The requested `model` is only applied to the
    first (preferred) provider; fallbacks use their own default so a Gemini model id is never
    sent to Groq, etc. Raises LLMUnavailable if nothing is configured, LLMError if all fail."""
    chain = _resolve_chain(settings, preferred)
    if not chain:
        raise LLMUnavailable("no LLM provider is configured")
    errors: list[str] = []
    for index, provider in enumerate(chain):
        try:
            return await provider.complete(
                system=system, prompt=prompt, model=model if index == 0 else None,
                max_tokens=max_tokens,
            )
        except Exception as exc:  # noqa: BLE001 - fall through to the next provider
            errors.append(f"{provider.provider}: {exc}")
            log.warning("llm_provider_failed", provider=provider.provider, error=str(exc))
    raise LLMError("all configured LLM providers failed: " + "; ".join(errors))


async def generate_json(
    settings: Settings,
    *,
    system: str,
    prompt: str,
    preferred: str | None = None,
    model: str | None = None,
    max_tokens: int = 1024,
) -> tuple[dict, Usage]:
    """Structured (JSON) generation with the same cross-provider fallback as `generate`."""
    chain = _resolve_chain(settings, preferred)
    if not chain:
        raise LLMUnavailable("no LLM provider is configured")
    errors: list[str] = []
    for index, provider in enumerate(chain):
        try:
            return await provider.complete_structured(
                system=system, prompt=prompt, model=model if index == 0 else None,
                max_tokens=max_tokens,
            )
        except Exception as exc:  # noqa: BLE001 - fall through to the next provider
            errors.append(f"{provider.provider}: {exc}")
            log.warning("llm_structured_failed", provider=provider.provider, error=str(exc))
    raise LLMError("all configured LLM providers failed on structured output: " + "; ".join(errors))


async def stream_generate(
    settings: Settings,
    *,
    system: str,
    prompt: str,
    preferred: str | None = None,
    model: str | None = None,
    max_tokens: int = 4096,
) -> AsyncIterator[tuple[str, str | Usage]]:
    """Stream tokens with fallback *before the first token*: if a provider errors on connect,
    the next configured provider is tried. Once tokens are flowing a mid-stream error is
    surfaced as an ("error", message) event (we can't un-emit what the client already got)."""
    chain = _resolve_chain(settings, preferred)
    if not chain:
        raise LLMUnavailable("no LLM provider is configured")
    errors: list[str] = []
    for index, provider in enumerate(chain):
        started = False
        try:
            async for kind, payload in provider.stream(
                system=system, prompt=prompt, model=model if index == 0 else None,
                max_tokens=max_tokens,
            ):
                started = True
                yield kind, payload
            return
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{provider.provider}: {exc}")
            log.warning(
                "llm_stream_failed", provider=provider.provider, error=str(exc), started=started
            )
            if started:
                yield "error", str(exc)
                return
    yield "error", "all configured LLM providers failed: " + "; ".join(errors)
