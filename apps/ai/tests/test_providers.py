import pytest

from app.core.config import Settings
from app.services.llm import (
    PROVIDER_ORDER,
    LLMUnavailable,
    estimate_cost,
    provider_status,
    resolve_llm,
)

_NO_KEYS = dict(
    anthropic_api_key=None,
    openai_api_key=None,
    gemini_api_key=None,
    groq_api_key=None,
    openrouter_api_key=None,
)


def test_five_providers() -> None:
    assert PROVIDER_ORDER == ["anthropic", "openai", "gemini", "groq", "openrouter"]


def test_resolve_raises_without_keys() -> None:
    with pytest.raises(LLMUnavailable):
        resolve_llm(Settings(**_NO_KEYS))


def test_provider_status_reports_all_five() -> None:
    status = provider_status(Settings(**_NO_KEYS))
    assert len(status) == 5
    assert all(p["available"] is False for p in status)


def test_resolve_failover_picks_available() -> None:
    settings = Settings(**{**_NO_KEYS, "openai_api_key": "sk-test"})
    provider = resolve_llm(settings)  # anthropic unconfigured → failover to openai
    assert provider.provider == "openai"


def test_preferred_provider_wins() -> None:
    settings = Settings(
        **{**_NO_KEYS, "openai_api_key": "sk-a", "groq_api_key": "gk-b"}
    )
    assert resolve_llm(settings, preferred="groq").provider == "groq"


def test_cost_uses_known_pricing() -> None:
    assert estimate_cost("gpt-4o-mini", 1_000_000, 1_000_000) == round(0.15 + 0.6, 6)
