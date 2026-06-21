from fastapi import APIRouter

from app import __version__

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe. Readiness (db/redis checks) is added in Phase 2/11."""
    return {"status": "ok", "plane": "intelligence", "version": __version__}
