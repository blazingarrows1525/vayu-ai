"""Best-effort Redis cache. Degrades to a no-op if Redis is unreachable so the
copilot still works in local dev without the data tier running."""

from __future__ import annotations

from app.services.redis import get_redis


async def cache_get(key: str) -> str | None:
    try:
        return await get_redis().get(key)
    except Exception:
        return None


async def cache_set(key: str, value: str, ttl: int = 3600) -> None:
    try:
        await get_redis().set(key, value, ex=ttl)
    except Exception:
        pass
