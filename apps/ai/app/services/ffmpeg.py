"""Hardened ffmpeg invocation for user-uploaded media.

ffmpeg probes input by content *and* extension, and some demuxers (HLS, concat)
follow references inside the file — an uploaded `x.m3u8` can make ffmpeg read
arbitrary local files (e.g. /proc/self/environ) into the output. Every call on
untrusted input therefore pins the allowed demuxers + protocols, and uploads are
written under a fixed name so the client's filename never becomes a path.
"""

from __future__ import annotations

import asyncio
import re
from pathlib import Path

import structlog

log = structlog.get_logger(__name__)

# Real audio/video containers only — notably excludes hls, concat, and image2 patterns.
_SAFE_INPUT_ARGS = [
    "-protocol_whitelist", "file",
    "-format_whitelist", "mov,matroska,webm,avi,ogg,wav,mp3,flac,aac,flv,mpegts",
]


def safe_upload_path(directory: Path, filename: str, stem: str = "input") -> Path:
    """A path inside `directory` that keeps only a sanitized extension from `filename`."""
    suffix = re.sub(r"[^A-Za-z0-9.]", "", Path(filename).suffix)[:10]
    return directory / f"{stem}{suffix}"


async def run_ffmpeg(input_path: Path, *output_args: str) -> bool:
    """Run ffmpeg on an untrusted input file; True on success."""
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-nostdin", "-y", *_SAFE_INPUT_ARGS, "-i", str(input_path), *output_args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        log.warning("ffmpeg_failed", code=proc.returncode, stderr=stderr.decode()[-500:])
        return False
    return True
