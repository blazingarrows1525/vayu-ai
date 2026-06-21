from fastapi import APIRouter

from app.api.v1 import agents, copilot, health, rag

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(copilot.router, tags=["copilot"])
api_router.include_router(rag.router, tags=["rag"])
api_router.include_router(agents.router, tags=["agents"])
