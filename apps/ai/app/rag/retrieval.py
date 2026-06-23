"""Pure retrieval algorithms — hybrid fusion, MMR reranking, context compression.

Kept dependency-free and side-effect-free so they're unit-tested without a database.
The DB-backed hybrid query lives in `pipeline.py` and composes these.
"""

from __future__ import annotations

import math

Vector = list[float]


def cosine(a: Vector, b: Vector) -> float:
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


def reciprocal_rank_fusion(rankings: list[list[str]], k: int = 60) -> dict[str, float]:
    """Reciprocal Rank Fusion — robust hybrid combiner that needs no score
    normalization. Items ranked highly across multiple lists score highest."""
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, item in enumerate(ranking):
            scores[item] = scores.get(item, 0.0) + 1.0 / (k + rank + 1)
    return scores


def mmr_rerank(
    query_vec: Vector,
    candidates: list[tuple[str, Vector]],
    top_k: int,
    lambda_: float = 0.7,
) -> list[str]:
    """Maximal Marginal Relevance — trade off relevance to the query against
    diversity vs. already-selected items, to reduce near-duplicate context."""
    selected: list[tuple[str, Vector]] = []
    remaining = list(candidates)
    relevance = {cid: cosine(query_vec, vec) for cid, vec in candidates}

    while remaining and len(selected) < top_k:
        best: tuple[str, Vector] | None = None
        best_score = -math.inf
        for cid, vec in remaining:
            diversity = max(
                (cosine(vec, svec) for _, svec in selected), default=0.0
            )
            score = lambda_ * relevance[cid] - (1.0 - lambda_) * diversity
            if score > best_score:
                best_score = score
                best = (cid, vec)
        assert best is not None
        selected.append(best)
        remaining.remove(best)
    return [cid for cid, _ in selected]


def compress(chunks: list[tuple[str, str]], max_chars: int = 6000) -> list[tuple[str, str]]:
    """Drop near-duplicate chunks and cap the total context to a char budget,
    preserving input order (assumed already ranked)."""
    kept: list[tuple[str, str]] = []
    seen_prefixes: set[str] = set()
    total = 0
    for cid, text in chunks:
        prefix = text[:80].strip().lower()
        if prefix in seen_prefixes:
            continue
        seen_prefixes.add(prefix)
        if total + len(text) > max_chars:
            text = text[: max(0, max_chars - total)]
        if not text:
            break
        kept.append((cid, text))
        total += len(text)
        if total >= max_chars:
            break
    return kept
