"""Research / RAG endpoints (Module 3). Pipeline implemented in Phase 6."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.security import Principal, get_principal, require_workspace

router = APIRouter(prefix="/rag")


class AskRequest(BaseModel):
    query: str
    source_scope: list[str] | None = None
    top_k: int = Field(default=8, ge=1, le=50)


class Citation(BaseModel):
    source_id: str
    chunk_index: int
    score: float
    snippet: str


class AskResponse(BaseModel):
    answer: str
    confidence: float
    citations: list[Citation]
    retrieval: dict


@router.post("/ask", response_model=AskResponse)
async def ask(
    req: AskRequest,
    principal: Principal = Depends(get_principal),
) -> AskResponse:
    require_workspace(principal)
    # Phase 6: embed(query) → pgvector ANN (workspace-scoped) → rerank → ground.
    return AskResponse(
        answer="RAG pipeline is scaffolded; grounded answers arrive in Phase 6.",
        confidence=0.0,
        citations=[],
        retrieval={"model": "text-embedding-3-small", "candidates": 0, "used": 0},
    )
