"""Optional S3-compatible object storage for the raw uploaded file.

Activates only when both S3 credentials are set (MinIO locally, S3 / Cloudflare R2 /
Backblaze B2 in production). When unset it is a no-op: ingestion still parses, chunks,
and embeds the document — it just doesn't persist the original bytes. boto3 is
synchronous, so every call is dispatched to a worker thread to avoid blocking the event
loop, and every call is best-effort: a storage failure logs a warning and never breaks
ingestion.
"""

from __future__ import annotations

import asyncio

import structlog

from app.core.config import Settings

log = structlog.get_logger(__name__)


class ObjectStorage:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._bucket = settings.s3_bucket
        self._available = bool(
            settings.s3_access_key_id and settings.s3_secret_access_key
        )
        self._client = None
        self._bucket_ready = False

    @property
    def available(self) -> bool:
        return self._available

    def _get_client(self):  # type: ignore[no-untyped-def]
        if self._client is None:
            import boto3
            from botocore.config import Config

            self._client = boto3.client(
                "s3",
                endpoint_url=self._settings.s3_endpoint or None,
                region_name=self._settings.s3_region,
                aws_access_key_id=self._settings.s3_access_key_id,
                aws_secret_access_key=self._settings.s3_secret_access_key,
                # Path-style addressing keeps MinIO (and most S3-compatibles) happy.
                config=Config(
                    signature_version="s3v4", s3={"addressing_style": "path"}
                ),
            )
        return self._client

    def _ensure_bucket(self) -> None:
        if self._bucket_ready:
            return
        from botocore.exceptions import ClientError

        client = self._get_client()
        try:
            client.head_bucket(Bucket=self._bucket)
        except ClientError:
            params: dict = {"Bucket": self._bucket}
            region = self._settings.s3_region
            # AWS requires a LocationConstraint for every region except us-east-1.
            if region and region != "us-east-1":
                params["CreateBucketConfiguration"] = {"LocationConstraint": region}
            client.create_bucket(**params)
        self._bucket_ready = True

    async def put(self, key: str, data: bytes, content_type: str) -> str | None:
        """Upload bytes; return the stored key, or None if storage is off/failed."""
        if not self._available:
            return None

        def _upload() -> str:
            self._ensure_bucket()
            self._get_client().put_object(
                Bucket=self._bucket, Key=key, Body=data, ContentType=content_type
            )
            return key

        try:
            return await asyncio.to_thread(_upload)
        except Exception as exc:  # best-effort — never block ingestion on storage
            log.warning("object_storage_put_failed", key=key, error=str(exc))
            return None

    async def presigned_get_url(self, key: str, expires: int = 3600) -> str | None:
        """A short-lived signed URL the browser can use to download the raw file."""
        if not self._available:
            return None

        def _sign() -> str:
            return self._get_client().generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=expires,
            )

        try:
            return await asyncio.to_thread(_sign)
        except Exception as exc:
            log.warning("object_storage_presign_failed", key=key, error=str(exc))
            return None
