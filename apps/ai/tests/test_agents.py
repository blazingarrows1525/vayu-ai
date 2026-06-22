from fastapi.testclient import TestClient

from app.agents.graph import build_agent_graph
from app.agents.registry import AGENTS
from app.main import app
from app.services.llm import AnthropicProvider

client = TestClient(app)


def test_catalog_requires_auth() -> None:
    assert client.get("/v1/agents").status_code == 401


def test_run_requires_auth() -> None:
    assert client.post("/v1/agents/research/run", json={"task": "x"}).status_code == 401


def test_seven_agent_types() -> None:
    assert len(AGENTS) == 7
    assert set(AGENTS) == {
        "research",
        "writing",
        "seo",
        "docs",
        "proofread",
        "interview",
        "resume",
    }


def test_graph_compiles_for_every_agent() -> None:
    from app.core.config import Settings

    provider = AnthropicProvider(Settings(anthropic_api_key=None))
    for config in AGENTS.values():
        assert build_agent_graph(provider, config) is not None
