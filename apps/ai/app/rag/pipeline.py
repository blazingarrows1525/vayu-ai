"""RAG pipeline: ingest (parse→chunk→embed→store), retrieve (pgvector ANN),
and ground (cite-constrained answer)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.models import Embedding, KnowledgeSource
from app.rag.chunking import chunk_text, estimate_tokens
from app.rag.retrieval import compress, cosine, mmr_rerank, reciprocal_rank_fusion
from app.services.embeddings import Embedder
from app.services.llm import LLMUnavailable, resolve_llm

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
    storage_key: str | None = None,
) -> KnowledgeSource:
    chunks = chunk_text(text)
    source = KnowledgeSource(
        workspace_id=uuid.UUID(workspace_id),
        document_id=_opt_uuid(document_id),
        title=title,
        source_type=source_type,
        storage_key=storage_key,
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


async def keyword_search(
    session: AsyncSession,
    workspace_id: str,
    query: str,
    top_k: int,
    source_ids: list[str] | None,
) -> list[Embedding]:
    """Full-text keyword search (Postgres FTS). Production should add a generated
    tsvector column + GIN index; computed on the fly here for portability."""
    tsv = func.to_tsvector("english", Embedding.content)
    tsq = func.plainto_tsquery("english", query)
    stmt = select(Embedding).where(
        Embedding.workspace_id == uuid.UUID(workspace_id), tsv.op("@@")(tsq)
    )
    if source_ids:
        stmt = stmt.where(
            Embedding.knowledge_source_id.in_([uuid.UUID(s) for s in source_ids])
        )
    stmt = stmt.order_by(func.ts_rank(tsv, tsq).desc()).limit(top_k)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def hybrid_retrieve(
    session: AsyncSession,
    *,
    workspace_id: str,
    query: str,
    query_vec: list[float],
    top_k: int,
    source_ids: list[str] | None,
) -> list[Embedding]:
    """Vector + keyword candidates → Reciprocal Rank Fusion → MMR diversity rerank."""
    pool = max(top_k * 3, 12)
    vec_rows = await retrieve(session, workspace_id, query_vec, pool, source_ids)
    kw_rows = await keyword_search(session, workspace_id, query, pool, source_ids)

    by_id: dict[str, Embedding] = {}
    for emb, _ in vec_rows:
        by_id[str(emb.id)] = emb
    for emb in kw_rows:
        by_id[str(emb.id)] = emb

    fused = reciprocal_rank_fusion(
        [[str(e.id) for e, _ in vec_rows], [str(e.id) for e in kw_rows]]
    )
    candidates = [
        (cid, [float(x) for x in by_id[cid].embedding])
        for cid in sorted(by_id, key=lambda i: fused.get(i, 0.0), reverse=True)
    ]
    ranked_ids = mmr_rerank(query_vec, candidates, top_k)
    return [by_id[cid] for cid in ranked_ids]


def _confidence_from_scores(scores: list[float]) -> float:
    if not scores:
        return 0.0
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
            {"model": embedder.active_model, "candidates": 0, "used": 0, "configured": False},
        )

    query_vec = await embedder.embed_one(query)

    if settings.rag_hybrid:
        embeddings = await hybrid_retrieve(
            session,
            workspace_id=workspace_id,
            query=query,
            query_vec=query_vec,
            top_k=top_k,
            source_ids=source_scope,
        )
        mode = "hybrid+mmr"
    else:
        embeddings = [
            emb for emb, _ in await retrieve(session, workspace_id, query_vec, top_k, source_scope)
        ]
        mode = "vector"

    if not embeddings:
        return AskResult(
            "No relevant context found in your knowledge sources.",
            0.0,
            [],
            {"model": embedder.active_model, "candidates": 0, "used": 0, "mode": mode},
        )

    by_id = {str(emb.id): emb for emb in embeddings}
    # Context compression: dedupe + cap to a char budget before grounding.
    compressed = compress(
        [(str(emb.id), emb.content) for emb in embeddings],
        settings.rag_max_context_chars,
    )
    context = "\n\n".join(f"[{i + 1}] {text}" for i, (_, text) in enumerate(compressed))

    try:
        provider = resolve_llm(settings)
        answer, _ = await provider.complete(
            system=_GROUND_SYSTEM,
            prompt=f"Question: {query}\n\nSources:\n{context}",
            max_tokens=1024,
        )
    except LLMUnavailable:
        answer = (
            "Retrieved relevant context (see citations). Configure a model provider key "
            "to generate a grounded answer from it."
        )

    citations: list[Citation] = []
    scores: list[float] = []
    for cid, text in compressed:
        emb = by_id[cid]
        score = round(max(0.0, cosine(query_vec, [float(x) for x in emb.embedding])), 3)
        scores.append(score)
        citations.append(
            Citation(
                source_id=str(emb.knowledge_source_id),
                chunk_index=emb.chunk_index,
                score=score,
                snippet=text[:240],
            )
        )

    return AskResult(
        answer=answer,
        confidence=_confidence_from_scores(scores),
        citations=citations,
        retrieval={
            "model": embedder.active_model,
            "candidates": len(embeddings),
            "used": len(compressed),
            "mode": mode,
        },
    )


async def semantic_search(
    session: AsyncSession,
    settings: Settings,
    *,
    workspace_id: str,
    query: str,
    top_k: int,
) -> list[dict] | None:
    """Vault-wide semantic search, grouped by source. None = embeddings off."""
    embedder = Embedder(settings)
    if not embedder.available:
        return None
    query_vec = await embedder.embed_one(query)
    rows = await retrieve(session, workspace_id, query_vec, top_k, None)

    by_source: dict[str, dict] = {}
    for emb, dist in rows:
        sid = str(emb.knowledge_source_id)
        score = round(max(0.0, 1.0 - dist), 3)
        if sid not in by_source:
            by_source[sid] = {
                "sourceId": sid,
                "score": score,
                "snippet": emb.content[:200],
                "hits": 1,
            }
        else:
            by_source[sid]["hits"] += 1
    return list(by_source.values())


async def related_sources(
    session: AsyncSession,
    settings: Settings,
    *,
    workspace_id: str,
    source_id: str,
    top_k: int,
) -> list[dict]:
    """Nearest *other* sources to a given source (knowledge-graph edges)."""
    seed = (
        await session.execute(
            select(Embedding)
            .where(Embedding.knowledge_source_id == uuid.UUID(source_id))
            .limit(1)
        )
    ).scalar_one_or_none()
    if seed is None:
        return []

    rows = await retrieve(session, workspace_id, list(seed.embedding), top_k + 8, None)
    out: dict[str, dict] = {}
    for emb, dist in rows:
        sid = str(emb.knowledge_source_id)
        if sid == source_id or sid in out:
            continue
        out[sid] = {"sourceId": sid, "score": round(max(0.0, 1.0 - dist), 3)}
        if len(out) >= top_k:
            break
    return list(out.values())
