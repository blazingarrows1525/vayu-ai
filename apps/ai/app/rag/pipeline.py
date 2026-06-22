"""RAG pipeline: ingest (parse→chunk→embed→store), retrieve (pgvector ANN),
and ground (cite-constrained answer)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.models import Embedding, KnowledgeSource
from app.rag.chunking import chunk_text, estimate_tokens
from app.services.embeddings import Embedder
from app.services.llm import AnthropicProvider, LLMUnavailable

_GROUND_SYSTEM = (
    "You are VAYU's research assistant. Answer the question using ONLY the numbered "
    "sources provided. Cite sources inline like [1], [2]. If the sources do not contain "
    "the answer, say so plainly. Be concise and accurate."
)


@dataclass(slots=True)
class Citation:
    source_id: str
    chunk_index: int
    score: float
    snippet: str


@dataclass(slots=True)
class AskResult:
    answer: str
    confidence: float
    citations: list[Citation]
    retrieval: dict


def _opt_uuid(value: str | None) -> uuid.UUID | None:
    return uuid.UUID(value) if value else None


async def ingest_document(
    session: AsyncSession,
    settings: Settings,
    *,
    workspace_id: str,
    created_by: str | None,
    document_id: str | None,
    title: str,
    source_type: str,
    text: str,
) -> KnowledgeSource:
    chunks = chunk_text(text)
    source = KnowledgeSource(
        workspace_id=uuid.UUID(workspace_id),
        document_id=_opt_uuid(document_id),
        title=title,
        source_type=source_type,
        created_by=_opt_uuid(created_by),
        status="processing",
        chunk_count=len(chunks),
        token_count=sum(estimate_tokens(c) for c in chunks),
    )
    session.add(source)
    await session.flush()

    embedder = Embedder(settings)
    if embedder.available and chunks:
        vectors = await embedder.embed(chunks)
        for index, (content, vector) in enumerate(zip(chunks, vectors, strict=True)):
            session.add(
                Embedding(
                    knowledge_source_id=source.id,
                    workspace_id=source.workspace_id,
                    document_id=source.document_id,
                    chunk_index=index,
                    content=content,
                    token_count=estimate_tokens(content),
                    embedding=vector,
                    meta={},
                )
            )
        source.status = "ready"
    else:
        source.status = "ready" if embedder.available else "pending_embeddings"

    await session.commit()
    return source


async def retrieve(
    session: AsyncSession,
    workspace_id: str,
    query_vec: list[float],
    top_k: int,
    source_ids: list[str] | None,
) -> list[tuple[Embedding, float]]:
    distance = Embedding.embedding.cosine_distance(query_vec).label("distance")
    stmt = select(Embedding, distance).where(
        Embedding.workspace_id == uuid.UUID(workspace_id)
    )
    if source_ids:
        stmt = stmt.where(
            Embedding.knowledge_source_id.in_([uuid.UUID(s) for s in source_ids])
        )
    stmt = stmt.order_by(distance).limit(top_k)
    result = await session.execute(stmt)
    return [(row[0], float(row[1])) for row in result.all()]


def _confidence(rows: list[tuple[Embedding, float]]) -> float:
    if not rows:
        return 0.0
    scores = [max(0.0, 1.0 - dist) for _, dist in rows]
    top = scores[0]
    coverage = sum(1 for s in scores if s > 0.3) / len(scores)
    return round(min(1.0, 0.6 * top + 0.4 * coverage), 2)


async def answer_question(
    session: AsyncSession,
    settings: Settings,
    *,
    workspace_id: str,
    query: str,
    source_scope: list[str] | None,
    top_k: int,
) -> AskResult:
    embedder = Embedder(settings)
    if not embedder.available:
        return AskResult(
            "Retrieval needs OPENAI_API_KEY for embeddings. Set it on the intelligence plane.",
            0.0,
            [],
            {"model": settings.embedding_model, "candidates": 0, "used": 0, "configured": False},
        )

    query_vec = await embedder.embed_one(query)
    rows = await retrieve(session, workspace_id, query_vec, top_k, source_scope)
    if not rows:
        return AskResult(
            "No relevant context found in your knowledge sources.",
            0.0,
            [],
            {"model": settings.embedding_model, "candidates": 0, "used": 0},
        )

    context = "\n\n".join(
        f"[{i + 1}] {emb.content}" for i, (emb, _) in enumerate(rows)
    )
    provider = AnthropicProvider(settings)
    try:
        answer, _ = await provider.complete(
            system=_GROUND_SYSTEM,
            prompt=f"Question: {query}\n\nSources:\n{context}",
            max_tokens=1024,
        )
    except LLMUnavailable:
        answer = (
            "Retrieved relevant context (see citations). Set ANTHROPIC_API_KEY to "
            "generate a grounded answer from it."
        )

    citations = [
        Citation(
            source_id=str(emb.knowledge_source_id),
            chunk_index=emb.chunk_index,
            score=round(max(0.0, 1.0 - dist), 3),
            snippet=emb.content[:240],
        )
        for emb, dist in rows
    ]
    return AskResult(
        answer=answer,
        confidence=_confidence(rows),
        citations=citations,
        retrieval={
            "model": settings.embedding_model,
            "candidates": len(rows),
            "used": len(rows),
        },
    )
