"""VAYU Live WebSocket protocol: auth gate, ready/token/done framing, rolling history,
malformed input, rate limiting, output-safety retraction — no network, Redis, or DB."""

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

import app.api.v1.ws as ws_module
from app.core.config import Settings, get_settings
from app.main import app
from app.services.safety import SafetyResult

_NO_KEYS = dict(
    anthropic_api_key=None,
    openai_api_key=None,
    nvidia_api_key=None,
    nvidia_safety_api_key=None,
    gemini_api_key=None,
    groq_api_key=None,
    openrouter_api_key=None,
)


@pytest.fixture
def live(monkeypatch):
    """Dev-token settings, an always-allow limiter, and a scripted LLM stream."""
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None, auth_allow_dev_token=True, **_NO_KEYS
    )
    prompts: list[str] = []

    async def fake_stream(settings, *, system, prompt, **_kw):
        prompts.append(prompt)
        for piece in ("Hello", " there."):
            yield "token", piece

    async def allow(*_a, **_kw):
        return True

    monkeypatch.setattr(ws_module, "stream_generate", fake_stream)
    monkeypatch.setattr(ws_module, "allow_request", allow)
    yield TestClient(app), prompts
    app.dependency_overrides.clear()


def _authed(ws) -> dict:
    ws.send_json({"type": "auth", "token": "dev"})
    return ws.receive_json()


def _turn(ws) -> list[dict]:
    frames = []
    while True:
        frame = ws.receive_json()
        frames.append(frame)
        if frame["type"] == "done":
            return frames


def test_rejects_missing_auth(live) -> None:
    client, _ = live
    with client.websocket_connect("/v1/ws/chat") as ws:
        ws.send_json({"type": "text", "content": "hi"})
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
    assert exc.value.code == 1008


def test_rejects_bad_token(live) -> None:
    client, _ = live
    with client.websocket_connect("/v1/ws/chat") as ws:
        ws.send_json({"type": "auth", "token": "not-a-jwt"})
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
    assert exc.value.code == 1008


def test_ready_reports_capabilities(live) -> None:
    client, _ = live
    with client.websocket_connect("/v1/ws/chat") as ws:
        assert _authed(ws) == {"type": "ready", "stt": False, "tts": False}


def test_text_turn_streams_tokens_then_done(live) -> None:
    client, _ = live
    with client.websocket_connect("/v1/ws/chat") as ws:
        _authed(ws)
        ws.send_json({"type": "text", "content": "hi"})
        frames = _turn(ws)
    assert frames == [
        {"type": "token", "content": "Hello"},
        {"type": "token", "content": " there."},
        {"type": "done"},
    ]


def test_second_turn_carries_history(live) -> None:
    client, prompts = live
    with client.websocket_connect("/v1/ws/chat") as ws:
        _authed(ws)
        for text in ("first question", "second question"):
            ws.send_json({"type": "text", "content": text})
            _turn(ws)
    assert prompts[0] == "first question"
    assert "User: first question\nAssistant: Hello there." in prompts[1]
    assert prompts[1].endswith("User: second question")


def test_malformed_frame_keeps_socket_open(live) -> None:
    client, _ = live
    with client.websocket_connect("/v1/ws/chat") as ws:
        _authed(ws)
        ws.send_text("{not json")
        assert _turn(ws)[0] == {"type": "error", "message": "Malformed message."}
        ws.send_json({"type": "ping"})
        assert ws.receive_json() == {"type": "pong"}


def test_audio_without_stt_is_a_turn_error(live) -> None:
    client, _ = live
    with client.websocket_connect("/v1/ws/chat") as ws:
        _authed(ws)
        ws.send_json({"type": "audio", "data": "AAAA", "mime": "audio/webm"})
        frames = _turn(ws)
    assert frames[0]["type"] == "error" and "isn't configured" in frames[0]["message"]


def test_rate_limit_blocks_turn(live, monkeypatch) -> None:
    client, prompts = live

    async def deny(*_a, **_kw):
        return False

    monkeypatch.setattr(ws_module, "allow_request", deny)
    with client.websocket_connect("/v1/ws/chat") as ws:
        _authed(ws)
        ws.send_json({"type": "text", "content": "hi"})
        frames = _turn(ws)
    assert frames[0]["type"] == "error" and prompts == []


def test_unsafe_output_is_retracted(live, monkeypatch) -> None:
    client, _ = live

    async def flag_output(self, prompt: str) -> SafetyResult:
        return SafetyResult(is_safe=prompt != "Hello there.")

    monkeypatch.setattr(ws_module.SafetyService, "check_prompt", flag_output)
    with client.websocket_connect("/v1/ws/chat") as ws:
        _authed(ws)
        ws.send_json({"type": "text", "content": "hi"})
        frames = _turn(ws)
    assert frames[-2] == {
        "type": "error",
        "message": "That response was flagged as unsafe and withheld.",
        "retract": True,
    }


@pytest.mark.parametrize(
    "mime, expected",
    [("audio/webm;codecs=opus", "live.webm"), ("audio/mp4", "live.m4a"),
     ("audio/ogg", "live.ogg"), (None, "live.webm"), ("../../etc", "live.webm")],
)
def test_audio_filename_from_mime(mime, expected) -> None:
    assert ws_module._audio_filename(mime) == expected
