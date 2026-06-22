"""LLM provider abstraction. Anthropic is the default; the streaming contract
is provider-agnostic so OpenAI/Gemini can be added behind the same interface."""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass

import anthropic

from app.core.config import Settings

# USD per 1M tokens: (input, output). Source: model pricing table.
_PRICING: dict[str, tuple[float, float]] = {
    "claude-opus-4-8": (5.0, 25.0),
    "claude-opus-4-7": (5.0, 25.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
}


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
    rate_in, rate_out = _PRICING.get(model, (5.0, 25.0))
    return round(input_tokens * rate_in / 1e6 + output_tokens * rate_out / 1e6, 6)


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
        self,
        *,
        system: str,
        prompt: str,
        model: str | None = None,
        max_tokens: int = 4096,
    ) -> AsyncIterator[tuple[str, str | Usage]]:
        """Yield ("token", text) deltas, then a final ("usage", Usage)."""
        if self._client is None:
            raise LLMUnavailable("ANTHROPIC_API_KEY is not configured")

        mdl = model or self._settings.default_chat_model
        # Opus 4.8: omit `thinking` for low-latency copilot edits.
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
                input_tokens=final.usage.input_tokens,
                output_tokens=final.usage.output_tokens,
                cost_usd=estimate_cost(
                    mdl, final.usage.input_tokens, final.usage.output_tokens
                ),
                model=mdl,
                provider=self.provider,
            ),
        )
