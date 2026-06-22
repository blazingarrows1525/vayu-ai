"""Paragraph-aware chunking with overlap. Keeps chunks near a target size so
embeddings stay semantically coherent without splitting mid-thought."""

from __future__ import annotations


def chunk_text(text: str, *, target_chars: int = 1200, overlap: int = 150) -> list[str]:
    text = text.strip()
    if not text:
        return []

    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    chunks: list[str] = []
    buffer = ""

    for para in paragraphs:
        if buffer and len(buffer) + len(para) + 1 > target_chars:
            chunks.append(buffer.strip())
            tail = buffer[-overlap:]
            buffer = f"{tail} {para}"
        else:
            buffer = f"{buffer}\n{para}" if buffer else para

    if buffer.strip():
        chunks.append(buffer.strip())
    return chunks


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)
