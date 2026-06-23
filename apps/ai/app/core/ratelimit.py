"""Redis fixed-window rate limiter with a small circuit breaker. Fails open if
Redis is unreachable, and stops hammering a downed Redis for a cooldown window so
a cache outage never adds latency to every request."""

from __future__ import annotations

import time

from app.services.redis import get_redis

_BREAKER_COOLDOWN = 30.0
_redis_down_until = 0.0


async def allow_request(key: str, limit: int, window_seconds: int) -> bool:
    global _redis_down_until
    if time.monotonic() < _redis_down_until:
        return True  # circuit open — skip Redis, fail open
    try:
        redis = get_redis()
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, window_seconds)
        return count <= limit
    except Exception:
        _redis_down_until = time.monotonic() + _BREAKER_COOLDOWN
        return True  # fail-open
