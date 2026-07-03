"""Enterprise AI Safety using Llama Guard 3."""

from __future__ import annotations

import structlog
from openai import AsyncOpenAI
from pydantic import BaseModel

from app.core.config import Settings

log = structlog.get_logger(__name__)


class SafetyResult(BaseModel):
    is_safe: bool
    reason: str | None = None


class SafetyService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: AsyncOpenAI | None
        self._available = bool(settings.nvidia_api_key)
        self._model = settings.nvidia_safety_model or "nvidia/llama-3.1-nemoguard-8b-content-safety"
        if self._available:
            self._client = AsyncOpenAI(
                api_key=settings.nvidia_api_key, base_url=settings.nvidia_base_url
            )
        else:
            self._client = None

    @property
    def available(self) -> bool:
        return self._available

    async def check_prompt(self, prompt: str) -> SafetyResult:
        if not self._available or not self._client:
            # Bypass if no key provided
            return SafetyResult(is_safe=True)

        try:
            resp = await self._client.chat.completions.create(
                model=self._model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=20,
                temperature=0.0,
            )
            content = resp.choices[0].message.content or ""
            content = content.strip().lower()

            if content.startswith("unsafe"):
                lines = content.split("\n")
                reason = lines[1] if len(lines) > 1 else "policy_violation"
                log.warning("unsafe_prompt_detected", reason=reason)
                return SafetyResult(is_safe=False, reason=reason.upper())

            return SafetyResult(is_safe=True)

        except Exception as exc:
            log.warning("safety_check_failed", error=str(exc))
            # Fail-open to preserve availability if model API hiccups
            return SafetyResult(is_safe=True)
