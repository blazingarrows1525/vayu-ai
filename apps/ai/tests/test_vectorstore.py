import pytest

from app.core.config import Settings
from app.rag.vectorstore import (
    ChromaStore,
    PineconeStore,
    QdrantStore,
    VectorHit,
    get_vector_store,
    vector_store_status,
)


def test_pgvector_default_is_in_db() -> None:
    assert get_vector_store(Settings(vector_store="pgvector")) is None
    assert get_vector_store(Settings(vector_store="")) is None


def test_unknown_store_raises() -> None:
    with pytest.raises(ValueError, match="unknown vector store"):
        get_vector_store(Settings(vector_store="nope"))


def test_qdrant_selected_and_availability() -> None:
    store = get_vector_store(
        Settings(vector_store="qdrant", qdrant_url="http://localhost:6333")
    )
    assert isinstance(store, QdrantStore)
    assert store.available is True
    assert get_vector_store(Settings(vector_store="qdrant")).available is False


def test_pinecone_needs_host_and_key() -> None:
    store = get_vector_store(
        Settings(
            vector_store="pinecone",
            pinecone_api_key="k",
            pinecone_index_host="https://idx.svc.pinecone.io",
        )
    )
    assert isinstance(store, PineconeStore)
    assert store.available is True


def test_chroma_selected() -> None:
    store = get_vector_store(
        Settings(vector_store="chroma", chroma_url="http://localhost:8001")
    )
    assert isinstance(store, ChromaStore)
    assert store.available is True


def test_vector_hit_defaults() -> None:
    hit = VectorHit(id="1", score=0.9, content="x", source_id="s")
    assert hit.chunk_index == 0
    assert hit.metadata == {}


def test_vector_store_status_pgvector() -> None:
    assert vector_store_status(Settings(vector_store="pgvector")) == {
        "store": "pgvector",
        "external": False,
        "available": True,
    }


def test_vector_store_status_qdrant_unavailable() -> None:
    status = vector_store_status(Settings(vector_store="qdrant"))  # no URL configured
    assert status["external"] is True and status["available"] is False


def test_vector_store_status_unknown() -> None:
    status = vector_store_status(Settings(vector_store="nope"))
    assert status["available"] is False and status.get("error") == "unknown store"


def test_external_store_or_none_selection() -> None:
    import app.rag.pipeline as pipe

    assert pipe._external_store_or_none(Settings(vector_store="pgvector")) is None
    assert pipe._external_store_or_none(Settings(vector_store="qdrant")) is None  # unavailable
    store = pipe._external_store_or_none(
        Settings(vector_store="qdrant", qdrant_url="http://localhost:6333")
    )
    assert store is not None and store.name == "qdrant"


async def test_answer_from_hits_grounds_and_cites(monkeypatch) -> None:
    import app.rag.pipeline as pipe
    from app.services.llm import Usage

    async def fake_generate(settings, *, system, prompt, max_tokens=1024, **_):
        return "grounded answer [1][2]", Usage(1, 1, 0.0, "m", "fake")

    monkeypatch.setattr(pipe, "generate", fake_generate)
    hits = [
        VectorHit(id="s:0", score=0.9, content="Alpha fact", source_id="s", chunk_index=0),
        VectorHit(id="s:1", score=0.5, content="Beta fact", source_id="s", chunk_index=1),
    ]
    result = await pipe._answer_from_hits(Settings(), "q?", hits, "qdrant")
    assert result.answer == "grounded answer [1][2]"
    assert len(result.citations) == 2
    assert result.citations[0].source_id == "s"
    assert result.retrieval["mode"] == "qdrant"
