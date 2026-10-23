from fastapi import APIRouter, Depends

from app import __version__
from app.core.config import Settings, get_settings
from app.rag.vectorstore import vector_store_status
from app.services.embeddings import Embedder
from app.services.llm import provider_status
from app.services.storage import ObjectStorage

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe. Readiness (db/redis checks) is added in Phase 2/11."""
    return {"status": "ok", "plane": "intelligence", "version": __version__}


@router.get("/providers")
async def providers(settings: Settings = Depends(get_settings)) -> dict:
    """Configured/available state of every LLM + embedding provider."""
    embedder = Embedder(settings)
    return {
        "default_llm_provider": settings.default_llm_provider,
        "llm": provider_status(settings),
        "embeddings": {
            "provider": embedder.provider,
            "model": embedder.active_model,
            "available": embedder.available,
        },
        "vector_store": vector_store_status(settings),
        "storage": {"provider": "s3", "available": ObjectStorage(settings).available},
    }
