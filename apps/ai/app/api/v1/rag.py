"""Research / RAG endpoints (Module 3)."""

from __future__ import annotations

import asyncio
import ipaddress
import socket
import uuid
from urllib.parse import urlparse

import httpx
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
from app.rag.parsing import detect_source_type, extract_text, html_to_text
from app.rag.pipeline import (
    answer_question,
    ingest_document,
    related_sources,
    semantic_search,
)
from app.services.storage import ObjectStorage


async def _is_public_url(url: str) -> bool:
    """SSRF guard: only http(s) to a publicly-routable host (blocks localhost,
    private ranges, link-local/cloud-metadata)."""
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return False
    try:
        infos = await asyncio.to_thread(socket.getaddrinfo, parsed.hostname, None)
    except OSError:
        return False
    for *_, sockaddr in infos:
        ip = ipaddress.ip_address(sockaddr[0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            return False
    return True

router = APIRouter()


class AskRequest(BaseModel):
    query: str
    source_scope: list[str] | None = None
    top_k: int = Field(default=8, ge=1, le=50)


class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=12, ge=1, le=50)


class IngestUrlRequest(BaseModel):
    url: str
    title: str | None = None
    document_id: str | None = None


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
        "stored": bool(s.storage_key),
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
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"File is {len(data) // (1024 * 1024)}MB; the limit is {settings.max_upload_mb}MB.",
        )
    try:
        text = extract_text(file.filename or "", data)
    except ValueError as exc:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc)) from exc

    # Persist the original file to object storage when configured (opt-in, best-effort).
    storage = ObjectStorage(settings)
    storage_key: str | None = None
    if storage.available:
        key = f"{workspace_id}/{uuid.uuid4()}/{file.filename or 'upload'}"
        storage_key = await storage.put(
            key, data, file.content_type or "application/octet-stream"
        )

    source = await ingest_document(
        session,
        settings,
        workspace_id=workspace_id,
        created_by=principal.user_id,
        document_id=document_id,
        title=title or file.filename or "Untitled",
        source_type=detect_source_type(file.filename or ""),
        text=text,
        storage_key=storage_key,
    )
    return _source_json(source)


@router.post("/knowledge/ingest-url")
async def ingest_url(
    req: IngestUrlRequest,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    workspace_id = require_workspace(principal)
    if not await _is_public_url(req.url):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "URL must be a public http(s) address"
        )
    try:
        async with httpx.AsyncClient(
            timeout=20.0, follow_redirects=True, headers={"user-agent": "VAYU-AI/1.0"}
        ) as client:
            resp = await client.get(req.url)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"could not fetch URL: {exc}"
        ) from exc

    content_type = resp.headers.get("content-type", "")
    text = resp.text if "text/plain" in content_type else html_to_text(resp.text)
    if not text.strip():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "no extractable text at URL"
        )

    source = await ingest_document(
        session,
        settings,
        workspace_id=workspace_id,
        created_by=principal.user_id,
        document_id=req.document_id,
        title=req.title or req.url,
        source_type="url",
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


@router.get("/knowledge/{source_id}/raw")
async def raw_file(
    source_id: str,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Short-lived signed URL to download the original uploaded file (if stored)."""
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
    if not source.storage_key:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No raw file stored for this source")
    url = await ObjectStorage(settings).presigned_get_url(source.storage_key)
    if not url:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Object storage is not configured")
    return {"url": url}


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
