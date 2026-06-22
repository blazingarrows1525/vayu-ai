"""Research / RAG endpoints (Module 3)."""

from __future__ import annotations

import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.security import Principal, get_principal, require_workspace
from app.db.base import get_session
from app.db.models import KnowledgeSource
from app.rag.parsing import detect_source_type, extract_text
from app.rag.pipeline import (
    answer_question,
    ingest_document,
    related_sources,
    semantic_search,
)

router = APIRouter()


class AskRequest(BaseModel):
    query: str
    source_scope: list[str] | None = None
    top_k: int = Field(default=8, ge=1, le=50)


class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=12, ge=1, le=50)


async def _attach_titles(
    session: AsyncSession, workspace_id: str, results: list[dict]
) -> list[dict]:
    ids = [uuid.UUID(r["sourceId"]) for r in results]
    if not ids:
        return results
    rows = await session.execute(
        select(KnowledgeSource.id, KnowledgeSource.title).where(
            KnowledgeSource.id.in_(ids),
            KnowledgeSource.workspace_id == uuid.UUID(workspace_id),
        )
    )
    titles = {str(rid): title for rid, title in rows.all()}
    for r in results:
        r["title"] = titles.get(r["sourceId"], "Untitled")
    return results


def _source_json(s: KnowledgeSource) -> dict:
    return {
        "id": str(s.id),
        "title": s.title,
        "status": s.status,
        "chunkCount": s.chunk_count,
        "tokenCount": s.token_count,
        "sourceType": s.source_type,
        "createdAt": s.created_at.isoformat() if s.created_at else None,
    }


@router.post("/knowledge/ingest")
async def ingest(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    document_id: str | None = Form(default=None),
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    workspace_id = require_workspace(principal)
    data = await file.read()
    try:
        text = extract_text(file.filename or "", data)
    except ValueError as exc:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc)) from exc

    source = await ingest_document(
        session,
        settings,
        workspace_id=workspace_id,
        created_by=principal.user_id,
        document_id=document_id,
        title=title or file.filename or "Untitled",
        source_type=detect_source_type(file.filename or ""),
        text=text,
    )
    return _source_json(source)


@router.get("/knowledge")
async def list_sources(
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    workspace_id = require_workspace(principal)
    result = await session.execute(
        select(KnowledgeSource)
        .where(KnowledgeSource.workspace_id == uuid.UUID(workspace_id))
        .order_by(KnowledgeSource.created_at.desc())
        .limit(100)
    )
    return {"sources": [_source_json(s) for s in result.scalars().all()]}


@router.get("/knowledge/{source_id}")
async def get_source(
    source_id: str,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    workspace_id = require_workspace(principal)
    result = await session.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.id == uuid.UUID(source_id),
            KnowledgeSource.workspace_id == uuid.UUID(workspace_id),
        )
    )
    source = result.scalar_one_or_none()
    if source is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Knowledge source not found")
    return _source_json(source)


@router.post("/search")
async def search(
    req: SearchRequest,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    workspace_id = require_workspace(principal)
    results = await semantic_search(
        session, settings, workspace_id=workspace_id, query=req.query, top_k=req.top_k
    )
    if results is None:
        return {"results": [], "configured": False}
    return {"results": await _attach_titles(session, workspace_id, results)}


@router.get("/knowledge/{source_id}/related")
async def related(
    source_id: str,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    workspace_id = require_workspace(principal)
    results = await related_sources(
        session, settings, workspace_id=workspace_id, source_id=source_id, top_k=6
    )
    return {"related": await _attach_titles(session, workspace_id, results)}


@router.post("/rag/ask")
async def ask(
    req: AskRequest,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    workspace_id = require_workspace(principal)
    result = await answer_question(
        session,
        settings,
        workspace_id=workspace_id,
        query=req.query,
        source_scope=req.source_scope,
        top_k=req.top_k,
    )
    return {
        "answer": result.answer,
        "confidence": result.confidence,
        "citations": [
            {
                "sourceId": c.source_id,
                "chunkIndex": c.chunk_index,
                "score": c.score,
                "snippet": c.snippet,
            }
            for c in result.citations
        ],
        "retrieval": result.retrieval,
    }
