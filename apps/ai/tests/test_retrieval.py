from app.rag.retrieval import compress, cosine, mmr_rerank, reciprocal_rank_fusion


def test_cosine_bounds() -> None:
    assert cosine([1.0, 0.0, 0.0], [1.0, 0.0, 0.0]) == 1.0
    assert cosine([1.0, 0.0], [0.0, 1.0]) == 0.0
    assert cosine([], [1.0]) == 0.0


def test_rrf_rewards_cross_list_agreement() -> None:
    fused = reciprocal_rank_fusion([["a", "b", "c"], ["b", "a", "d"]])
    assert fused["a"] > fused["c"]  # in both lists
    assert fused["b"] > fused["d"]


def test_mmr_prefers_relevant_then_diverse() -> None:
    query = [1.0, 0.0]
    candidates = [
        ("rel", [1.0, 0.0]),      # most relevant
        ("dup", [0.99, 0.01]),    # near-duplicate of rel
        ("div", [0.0, 1.0]),      # diverse
    ]
    out = mmr_rerank(query, candidates, top_k=2, lambda_=0.3)
    assert out[0] == "rel"
    assert out[1] == "div"  # diversity beats the near-duplicate at low lambda


def test_compress_dedupes_and_caps_budget() -> None:
    chunks = [("1", "alpha " * 10), ("2", "alpha " * 10), ("3", "beta " * 10)]
    kept = compress(chunks, max_chars=40)
    ids = [cid for cid, _ in kept]
    assert "2" not in ids  # near-duplicate of "1" dropped
    assert sum(len(text) for _, text in kept) <= 40
