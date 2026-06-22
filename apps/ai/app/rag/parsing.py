"""Extract plain text from uploaded documents."""

from __future__ import annotations

import io

_EXT_TO_TYPE = {
    "pdf": "pdf",
    "docx": "docx",
    "md": "md",
    "markdown": "md",
    "txt": "txt",
}


def _ext(filename: str) -> str:
    return filename.lower().rsplit(".", 1)[-1] if "." in filename else ""


def detect_source_type(filename: str) -> str:
    return _EXT_TO_TYPE.get(_ext(filename), "txt")


def extract_text(filename: str, data: bytes) -> str:
    ext = _ext(filename)
    if ext == "pdf":
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        return "\n\n".join((page.extract_text() or "") for page in reader.pages)
    if ext == "docx":
        import docx

        document = docx.Document(io.BytesIO(data))
        return "\n".join(p.text for p in document.paragraphs)
    if ext in {"txt", "md", "markdown", ""}:
        return data.decode("utf-8", errors="replace")
    raise ValueError(f"Unsupported file type: .{ext}")
