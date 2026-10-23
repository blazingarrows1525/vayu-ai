"""Gemini as the single-key backend for voice, video and embeddings, the best-effort media
ingest, and the /v1/diagnostics self-check — all without network or a database."""

import base64
import io
import json
import wave
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.v1 import media
from app.core.config import Settings, get_settings
from app.db.base import get_session
from app.main import app
from app.services import gemini, voice
from app.services.embeddings import Embedder
from app.services.video import VideoService
from app.services.voice import VoiceService

_NO_KEYS = dict(
    anthropic_api_key=None,
    openai_api_key=None,
    nvidia_api_key=None,
    gemini_api_key=None,
    groq_api_key=None,
    openrouter_api_key=None,
    voyage_api_key=None,
)
_DEV = {"Authorization": "Bearer dev"}


def settings(**kw) -> Settings:
    return Settings(_env_file=None, **{**_NO_KEYS, **kw})


def _mock_httpx(monkeypatch, handler) -> list[httpx.Request]:
    """Route every httpx.AsyncClient through `handler`, recording requests."""
    seen: list[httpx.Request] = []
    real = httpx.AsyncClient

    def recording(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    monkeypatch.setattr(
        httpx, "AsyncClient",
        lambda **kw: real(transport=httpx.MockTransport(recording), **kw),
    )
    return seen


# ── provider selection ─────────────────────────────────────────────────────────


def test_gemini_alone_powers_voice_video_and_embeddings() -> None:
    s = settings(gemini_api_key="g", embedding_provider="voyage")
    v = VoiceService(s)
    assert (v.available, v.provider, v.tts_available, v.tts_provider) == (True, "gemini", True, "gemini")
    assert VideoService(s).provider == "gemini"
    e = Embedder(s)
    assert (e.provider, e.available, e.active_model) == ("gemini", True, "gemini-embedding-001")


def test_existing_providers_keep_priority_over_gemini() -> None:
    v = VoiceService(settings(nvidia_api_key="nv", gemini_api_key="g"))
    assert (v.provider, v.tts_provider) == ("nvidia", "gemini")
    v = VoiceService(settings(openai_api_key="sk", gemini_api_key="g"))
    assert (v.provider, v.tts_provider) == ("openai", "openai")
    assert VideoService(settings(nvidia_api_key="nv", gemini_api_key="g")).provider == "nvidia"
    assert Embedder(settings(embedding_provider="voyage", voyage_api_key="vk", gemini_api_key="g")).provider == "voyage"


def test_nothing_configured_stays_unavailable() -> None:
    s = settings()
    assert not VoiceService(s).available and not VoiceService(s).tts_available
    assert VideoService(s).provider is None
    assert not Embedder(s).available


# ── request shapes ─────────────────────────────────────────────────────────────


async def test_gemini_transcription_sends_mp3_audio(monkeypatch) -> None:
    transcode_args: dict = {}

    async def fake_transcode(audio, filename, *args, out_name):
        transcode_args.update(filename=filename, args=args, out_name=out_name)
        return b"MP3DATA"

    calls: list[dict] = []

    async def create(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=" hello world \n"))])

    fake = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(voice, "_transcode", fake_transcode)
    monkeypatch.setattr(gemini, "openai_client", lambda _s: fake)

    text = await VoiceService(settings(gemini_api_key="g")).transcribe(b"webm", "live.webm")

    assert text == "hello world"
    assert transcode_args["filename"] == "live.webm" and transcode_args["out_name"] == "audio.mp3"
    assert calls[0]["model"] == "gemini-2.5-flash"
    parts = calls[0]["messages"][0]["content"]
    audio = next(p for p in parts if p["type"] == "input_audio")["input_audio"]
    assert audio == {"data": base64.b64encode(b"MP3DATA").decode(), "format": "mp3"}


async def test_gemini_tts_wraps_pcm_in_wav(monkeypatch) -> None:
    pcm = b"\x01\x00" * 2400  # 0.1 s of 24 kHz 16-bit mono
    seen = _mock_httpx(monkeypatch, lambda req: httpx.Response(200, json={
        "candidates": [{"content": {"parts": [{"inlineData": {
            "mimeType": "audio/L16;codec=pcm;rate=24000",
            "data": base64.b64encode(pcm).decode(),
        }}]}}],
    }))

    wav_bytes = await VoiceService(settings(gemini_api_key="g")).synthesize("Hi there")

    req = seen[0]
    assert str(req.url).endswith("/models/gemini-2.5-flash-preview-tts:generateContent")
    assert req.headers["x-goog-api-key"] == "g"
    body = json.loads(req.content)
    assert body["generationConfig"]["responseModalities"] == ["AUDIO"]
    assert body["contents"][0]["parts"][0]["text"] == "Hi there"
    with wave.open(io.BytesIO(wav_bytes)) as w:
        assert (w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()) == (24000, 1, 2, 2400)


async def test_gemini_embeddings_batch_and_match_the_column_size(monkeypatch) -> None:
    def handler(req: httpx.Request) -> httpx.Response:
        n = len(json.loads(req.content)["requests"])
        return httpx.Response(200, json={"embeddings": [{"values": [0.1] * 1024}] * n})

    seen = _mock_httpx(monkeypatch, handler)
    vectors = await Embedder(settings(gemini_api_key="g", embedding_dim=1024)).embed(
        [f"chunk {i}" for i in range(150)]
    )

    assert len(vectors) == 150 and all(len(v) == 1024 for v in vectors)
    assert [len(json.loads(r.content)["requests"]) for r in seen] == [100, 50]
    first = json.loads(seen[0].content)["requests"][0]
    assert first["outputDimensionality"] == 1024
    assert first["model"] == "models/gemini-embedding-001"
    assert str(seen[0].url).endswith("/models/gemini-embedding-001:batchEmbedContents")


async def test_video_summary_uses_gemini_vision(monkeypatch) -> None:
    calls: list[dict] = []

    async def create(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="A demo."))])

    monkeypatch.setattr(
        gemini, "openai_client",
        lambda _s: SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create))),
    )
    client, model = VideoService(settings(gemini_api_key="g"))._vision()
    resp = await client.chat.completions.create(model=model, messages=[])
    assert model == "gemini-2.5-flash" and resp.choices[0].message.content == "A demo."


# ── endpoints ──────────────────────────────────────────────────────────────────


class _FakeSession:
    def __init__(self) -> None:
        self.rolled_back = False

    async def rollback(self) -> None:
        self.rolled_back = True

    async def execute(self, *_a, **_kw):
        raise RuntimeError("no database in tests")


@pytest.fixture
def client():
    session = _FakeSession()

    def make(**kw) -> TestClient:
        app.dependency_overrides[get_settings] = lambda: settings(auth_allow_dev_token=True, **kw)

        async def fake_session():
            yield session

        app.dependency_overrides[get_session] = fake_session
        return TestClient(app)

    make.session = session  # type: ignore[attr-defined]
    yield make
    app.dependency_overrides.clear()


def test_transcription_survives_a_failed_knowledge_base_save(client, monkeypatch) -> None:
    async def transcribe(self, audio, filename="audio.wav"):
        return "remember the milk"

    async def broken_ingest(*_a, **_kw):
        raise RuntimeError("relation \"knowledge_source\" does not exist")

    monkeypatch.setattr(VoiceService, "transcribe", transcribe)
    monkeypatch.setattr(media, "ingest_document", broken_ingest)
    res = client(gemini_api_key="g").post(
        "/v1/media/voice",
        files={"file": ("a.webm", b"\x1a\x45\xdf\xa3", "audio/webm")},
        data={"action": "transcribe"},
        headers=_DEV,
    )
    assert res.status_code == 200, res.text
    assert res.json()["transcript"] == "remember the milk"
    assert client.session.rolled_back


def test_diagnostics_requires_login() -> None:
    assert TestClient(app).get("/v1/diagnostics").status_code == 401


def test_diagnostics_reports_capabilities(client) -> None:
    res = client(gemini_api_key="AIza-secret-test-key").get("/v1/diagnostics", headers=_DEV)
    assert res.status_code == 200, res.text
    d = res.json()
    assert d["auth"]["ok"] is True
    assert d["voice"] == {"stt": "gemini", "tts": "gemini"}
    assert d["video"] == {"provider": "gemini"}
    assert d["embeddings"]["provider"] == "gemini" and d["embeddings"]["available"] is True
    assert "gemini" in d["llm"]["configured"] and d["llm"]["probe"] is None
    assert d["database"]["ok"] is False and "no database" in d["database"]["error"]
    assert "AIza-secret-test-key" not in res.text


def test_diagnostics_probe_reports_a_failing_key(client, monkeypatch) -> None:
    from app.api.v1 import diagnostics
    from app.services.llm import LLMError

    async def failing_generate(*_a, **_kw):
        raise LLMError("API key not valid")

    monkeypatch.setattr(diagnostics, "generate", failing_generate)
    d = client(gemini_api_key="g").get("/v1/diagnostics?probe=true", headers=_DEV).json()
    assert d["llm"]["probe"]["ok"] is False and "API key not valid" in d["llm"]["probe"]["error"]
