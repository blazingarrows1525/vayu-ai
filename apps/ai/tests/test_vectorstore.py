import pytest

from app.core.config import Settings
from app.rag.vectorstore import (
    ChromaStore,
    PineconeStore,
    QdrantStore,
    VectorHit,
    get_vector_store,
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
