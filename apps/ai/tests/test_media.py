"""Media endpoints (voice/video): auth, workspace scoping, upload caps, TTS degradation,
and the ffmpeg hardening for untrusted uploads — all without network or a database."""

import shutil
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.v1.media import _speak
from app.core.config import Settings, get_settings
from app.db.base import get_session
from app.main import app
from app.services.ffmpeg import run_ffmpeg, safe_upload_path
from app.services.voice import VoiceService

_NO_KEYS = dict(
    anthropic_api_key=None,
    openai_api_key=None,
    nvidia_api_key=None,
    gemini_api_key=None,
    groq_api_key=None,
    openrouter_api_key=None,
)


def settings(**kw) -> Settings:
    """Hermetic Settings — never reads the developer's real .env."""
    return Settings(_env_file=None, **{**_NO_KEYS, **kw})


@pytest.fixture
def dev_client():
    """A client whose `Bearer dev` token is accepted, with a DB-free session."""

    def override(**kw):
        app.dependency_overrides[get_settings] = lambda: settings(
            auth_allow_dev_token=True, **kw
        )
        return TestClient(app)

    async def no_db():
        yield None

    app.dependency_overrides[get_session] = no_db
    yield override
    app.dependency_overrides.clear()


_AUDIO = {"file": ("a.webm", b"\x1a\x45\xdf\xa3fake", "audio/webm")}
_DEV = {"Authorization": "Bearer dev"}


@pytest.mark.parametrize("path", ["/v1/media/voice", "/v1/media/video"])
def test_media_requires_auth(path: str) -> None:
    assert TestClient(app).post(path, files=_AUDIO).status_code == 401


def test_voice_503_when_unconfigured(dev_client) -> None:
    res = dev_client().post("/v1/media/voice", files=_AUDIO, headers=_DEV)
    assert res.status_code == 503


def test_video_503_when_unconfigured(dev_client) -> None:
    res = dev_client().post("/v1/media/video", files=_AUDIO, headers=_DEV)
    assert res.status_code == 503


def test_voice_rejects_oversized_upload(dev_client) -> None:
    client = dev_client(openai_api_key="sk-test", max_upload_mb=0)
    res = client.post("/v1/media/voice", files=_AUDIO, headers=_DEV)
    assert res.status_code == 413


def test_voice_rejects_unknown_action(dev_client) -> None:
    client = dev_client(openai_api_key="sk-test")
    res = client.post(
        "/v1/media/voice", files=_AUDIO, data={"action": "rm -rf"}, headers=_DEV
    )
    assert res.status_code == 422


def test_workspace_id_form_field_is_ignored(dev_client) -> None:
    # The workspace comes from the token; a spoofed form field is not a parameter anymore.
    client = dev_client(openai_api_key="sk-test", max_upload_mb=0)
    res = client.post(
        "/v1/media/voice", files=_AUDIO, data={"workspace_id": "default"}, headers=_DEV
    )
    assert res.status_code == 413  # reached the size check — no uuid("default") crash


def test_tts_prefers_openai_when_configured() -> None:
    svc = VoiceService(settings(nvidia_api_key="nv", openai_api_key="sk"))
    assert svc._provider == "nvidia"  # STT stays on NVIDIA
    assert svc._tts_model == "tts-1"  # TTS uses OpenAI's known-good endpoint
    assert svc.tts_available


def test_tts_unavailable_without_keys() -> None:
    svc = VoiceService(settings())
    assert not svc.available and not svc.tts_available


class _FailingVoice:
    tts_available = True

    async def synthesize(self, text: str) -> bytes:
        raise RuntimeError("tts endpoint 404")


class _WorkingVoice:
    tts_available = True

    async def synthesize(self, text: str) -> bytes:
        return b"RIFF"


async def test_speak_degrades_to_text_only() -> None:
    assert await _speak(_FailingVoice(), "hello") is None  # type: ignore[arg-type]


async def test_speak_returns_wav_data_url() -> None:
    url = await _speak(_WorkingVoice(), "hello")  # type: ignore[arg-type]
    assert url == "data:audio/wav;base64,UklGRg=="


@pytest.mark.parametrize(
    "filename, expected",
    [
        ("clip.mp4", "input.mp4"),
        ("../../etc/cron.d/x.mp4", "input.mp4"),
        ("/app/apps/ai/app/main.py", "input.py"),
        ("evil.m3u8", "input.m3u8"),
        ("no-extension", "input"),
        ("weird.m p\x004", "input.mp4"),
    ],
)
def test_safe_upload_path_stays_in_dir(tmp_path: Path, filename: str, expected: str) -> None:
    path = safe_upload_path(tmp_path, filename)
    assert path.parent == tmp_path
    assert path.name == expected


needs_ffmpeg = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")


def _synth_audio(path: Path, *codec: str) -> Path:
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "sine=duration=1", *codec, str(path)],
        check=True,
    )
    return path


@pytest.fixture
def hls_playlist(tmp_path: Path) -> Path:
    """An 'upload' that is really an HLS playlist pointing at a local file."""
    secret = _synth_audio(tmp_path / "secret.wav")
    playlist = tmp_path / "upload.m3u8"
    playlist.write_text(
        f"#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:1.0,\nfile://{secret}\n#EXT-X-ENDLIST\n"
    )
    return playlist


@needs_ffmpeg
async def test_ffmpeg_refuses_hls_playlist_reading_local_files(
    tmp_path: Path, hls_playlist: Path
) -> None:
    out = tmp_path / "out.wav"
    assert not await run_ffmpeg(hls_playlist, str(out))
    assert not out.exists()


@needs_ffmpeg
async def test_ffmpeg_still_decodes_real_media(tmp_path: Path) -> None:
    src = _synth_audio(tmp_path / "input.webm", "-c:a", "libopus")
    out = tmp_path / "out.wav"
    assert await run_ffmpeg(src, "-ar", "16000", "-ac", "1", str(out))
    assert out.exists()
