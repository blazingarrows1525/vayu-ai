"""Object storage gating — activation on credentials + graceful no-op when off (no network)."""

from app.core.config import Settings
from app.services.storage import ObjectStorage


def test_storage_disabled_without_creds() -> None:
    store = ObjectStorage(Settings(s3_access_key_id=None, s3_secret_access_key=None))
    assert store.available is False


def test_storage_enabled_with_both_creds() -> None:
    store = ObjectStorage(
        Settings(s3_access_key_id="AKIAEXAMPLE", s3_secret_access_key="secret")
    )
    assert store.available is True


def test_storage_needs_both_creds() -> None:
    assert ObjectStorage(Settings(s3_access_key_id="only-id")).available is False
    assert ObjectStorage(Settings(s3_secret_access_key="only-secret")).available is False


async def test_put_and_presign_are_noop_when_disabled() -> None:
    store = ObjectStorage(Settings(s3_access_key_id=None, s3_secret_access_key=None))
    assert await store.put("k", b"data", "text/plain") is None
    assert await store.presigned_get_url("k") is None
