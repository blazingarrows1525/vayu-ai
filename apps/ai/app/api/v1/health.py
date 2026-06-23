from fastapi import APIRouter, Depends

from app import __version__
from app.core.config import Settings, get_settings
from app.services.llm import provider_status

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe. Readiness (db/redis checks) is added in Phase 2/11."""
    return {"status": "ok", "plane": "intelligence", "version": __version__}


@router.get("/providers")
async def providers(settings: Settings = Depends(get_settings)) -> dict:
    """Configured/available state of every LLM + embedding provider."""
    return {
        "default_llm_provider": settings.default_llm_provider,
        "llm": provider_status(settings),
        "embeddings": {
            "provider": settings.embedding_provider,
            "model": settings.embedding_model
            if settings.embedding_provider == "openai"
            else settings.voyage_model,
            "available": bool(
                settings.openai_api_key
                if settings.embedding_provider == "openai"
                else settings.voyage_api_key
            ),
        },
    }
