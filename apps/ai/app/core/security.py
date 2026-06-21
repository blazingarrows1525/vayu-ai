"""The auth bridge: verify Better Auth JWTs via JWKS, yield a Principal.

The intelligence plane is stateless — it never touches the session store. It
trusts a short-lived access JWT minted by the product plane and verified here
against the product plane's public keys (JWKS). RBAC is re-derived from claims.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from .config import Settings, get_settings

_ALGORITHMS = ["RS256", "ES256", "EdDSA"]


@dataclass(slots=True)
class Principal:
    """The authenticated caller, derived from verified JWT claims."""

    user_id: str
    workspace_id: str | None = None
    role: str | None = None
    claims: dict = field(default_factory=dict)


_bearer = HTTPBearer(auto_error=True)
# PyJWKClient caches signing keys and only refetches on rotation.
_jwks_clients: dict[str, PyJWKClient] = {}


def _jwks_client(url: str) -> PyJWKClient:
    client = _jwks_clients.get(url)
    if client is None:
        client = PyJWKClient(url, cache_keys=True)
        _jwks_clients[url] = client
    return client


def verify_token(token: str, settings: Settings) -> Principal:
    if settings.auth_allow_dev_token and token == "dev":
        return Principal(
            user_id="00000000-0000-0000-0000-000000000001",
            workspace_id="00000000-0000-0000-0000-0000000000aa",
            role="owner",
            claims={"sub": "dev", "dev": True},
        )

    try:
        signing_key = _jwks_client(settings.auth_jwks_url).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=_ALGORITHMS,
            audience=settings.auth_jwt_audience,
            issuer=settings.auth_jwt_issuer,
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    return Principal(
        user_id=str(claims["sub"]),
        workspace_id=claims.get("workspace_id"),
        role=claims.get("role"),
        claims=claims,
    )


async def get_principal(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> Principal:
    return verify_token(credentials.credentials, settings)


def require_workspace(principal: Principal) -> str:
    """Guard for routes that must act inside a workspace."""
    if not principal.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No active workspace in token",
        )
    return principal.workspace_id
