from app.core.prompts import SUPPORTED_COMMANDS, build_prompt


def test_twelve_commands() -> None:
    assert len(SUPPORTED_COMMANDS) == 12
    assert "/improve" in SUPPORTED_COMMANDS


def test_change_tone_uses_tone() -> None:
    system, user = build_prompt("/change-tone", "Hello there", None, "formal")
    assert "formal" in system
    assert "Hello there" in user


def test_generate_uses_context() -> None:
    _system, user = build_prompt("/generate-blog", None, "AI safety", None)
    assert "AI safety" in user


def test_no_input_is_safe() -> None:
    _system, user = build_prompt("/improve", None, None, None)
    assert user  # never empty
