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
    nvidia_api_key=None,
    gemini_api_key=None,
    groq_api_key=None,
    openrouter_api_key=None,
)


def settings(**kw) -> Settings:
    """Hermetic Settings — never reads the developer's real .env."""
    return Settings(_env_file=None, **{**_NO_KEYS, **kw})


def test_six_providers_cheapest_first() -> None:
    assert PROVIDER_ORDER == ["gemini", "groq", "nvidia", "openai", "openrouter", "anthropic"]


def test_gemini_is_the_default_provider() -> None:
    s = settings(gemini_api_key="g-test", anthropic_api_key="sk-ant", openai_api_key="sk-a")
    assert s.default_llm_provider == "gemini"
    assert resolve_llm(s).provider == "gemini"


def test_resolve_raises_without_keys() -> None:
    with pytest.raises(LLMUnavailable):
        resolve_llm(settings())


def test_provider_status_reports_all() -> None:
    status = provider_status(settings())
    assert len(status) == len(PROVIDER_ORDER)
    assert all(p["available"] is False for p in status)


def test_resolve_failover_picks_available() -> None:
    provider = resolve_llm(settings(openai_api_key="sk-test"))
    assert provider.provider == "openai"  # gemini (default) unconfigured → failover


def test_preferred_provider_wins() -> None:
    s = settings(openai_api_key="sk-a", groq_api_key="gk-b")
    assert resolve_llm(s, preferred="groq").provider == "groq"


def test_nvidia_provider_available_when_keyed() -> None:
    provider = resolve_llm(settings(nvidia_api_key="nv-test"))
    assert provider.provider == "nvidia"


def test_cost_uses_known_pricing() -> None:
    assert estimate_cost("gpt-4o-mini", 1_000_000, 1_000_000) == round(0.15 + 0.6, 6)
