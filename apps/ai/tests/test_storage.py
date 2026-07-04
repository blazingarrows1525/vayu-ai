"""Object storage gating — activation on credentials + graceful no-op when off (no network)."""

from app.core.config import Settings
from app.services.storage import ObjectStorage


def settings(**kw) -> Settings:
    """Hermetic Settings — never reads the developer's real .env."""
    return Settings(
        _env_file=None,
        **{"s3_access_key_id": None, "s3_secret_access_key": None, **kw},
    )


def test_storage_disabled_without_creds() -> None:
    assert ObjectStorage(settings()).available is False


def test_storage_enabled_with_both_creds() -> None:
    store = ObjectStorage(
        settings(s3_access_key_id="AKIAEXAMPLE", s3_secret_access_key="secret")
    )
    assert store.available is True


def test_storage_needs_both_creds() -> None:
    assert ObjectStorage(settings(s3_access_key_id="only-id")).available is False
    assert ObjectStorage(settings(s3_secret_access_key="only-secret")).available is False


async def test_put_and_presign_are_noop_when_disabled() -> None:
    store = ObjectStorage(settings())
    assert await store.put("k", b"data", "text/plain") is None
    assert await store.presigned_get_url("k") is None
