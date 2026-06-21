from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root() -> None:
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["plane"] == "intelligence"


def test_health() -> None:
    res = client.get("/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"


def test_copilot_requires_auth() -> None:
    res = client.post("/v1/copilot", json={"command": "/improve"})
    # HTTPBearer with no Authorization header → 401 Unauthorized.
    assert res.status_code == 401
