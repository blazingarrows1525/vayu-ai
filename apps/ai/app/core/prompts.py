"""Per-command prompt construction for the writing copilot (Module 2)."""

from __future__ import annotations

SUPPORTED_COMMANDS: dict[str, str] = {
    "/rewrite": "Rewrite the text to express the same meaning in a fresh way, preserving intent and facts.",
    "/improve": "Improve clarity, flow, and concision without changing the meaning.",
    "/continue": "Continue the text naturally from where it ends. Output only the continuation, not the original.",
    "/summarize": "Summarize the text concisely, capturing the key points.",
    "/expand": "Expand the text with relevant detail and useful elaboration.",
    "/shorten": "Make the text shorter and tighter while keeping the essential meaning.",
    "/fix-grammar": "Correct grammar, spelling, and punctuation. Change nothing else.",
    "/change-tone": "Rewrite the text in the requested tone.",
    "/generate-outline": "Produce a clear, well-structured outline for the topic.",
    "/generate-blog": "Write an engaging, well-structured blog post on the topic.",
    "/generate-email": "Write a clear, professional email for the described purpose.",
    "/generate-docs": "Write clear, accurate technical documentation for the described subject.",
}

_BASE = (
    "You are VAYU's inline writing copilot. Output only the resulting text — no "
    "preamble, no explanation, and no code fences unless the content itself is code. "
    "Preserve the author's voice and any domain terminology."
)


def build_prompt(
    command: str,
    selection: str | None,
    context: str | None,
    tone: str | None,
) -> tuple[str, str]:
    """Return (system, user) prompts for a copilot command."""
    instruction = SUPPORTED_COMMANDS[command]
    if command == "/change-tone" and tone:
        instruction = f"Rewrite the text in a {tone} tone, preserving meaning."

    system = f"{_BASE} {instruction}"

    parts: list[str] = []
    if context:
        parts.append(f"Context:\n{context}")
    if selection:
        label = "Text" if command not in {"/continue"} else "Text so far"
        parts.append(f"{label}:\n{selection}")

    user = "\n\n".join(parts) if parts else "(no input provided)"
    return system, user
