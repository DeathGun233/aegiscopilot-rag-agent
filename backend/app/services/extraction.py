from __future__ import annotations

from io import BytesIO
from pathlib import Path

from docx import Document as DocxDocument
from pypdf import PdfReader

from .text import normalize_text


class ExtractionError(ValueError):
    pass


class ExtractionService:
    def extract(self, filename: str, content: bytes) -> str:
        suffix = Path(filename).suffix.lower()
        if suffix in {".txt", ".md", ".markdown"}:
            return self._decode_text(content)
        if suffix == ".pdf":
            return self._extract_pdf(content)
        if suffix == ".docx":
            return self._extract_docx(content)
        raise ExtractionError(f"Unsupported file type: {suffix or 'unknown'}")

    @staticmethod
    def _decode_text(content: bytes) -> str:
        for encoding in ("utf-8", "utf-8-sig", "gb18030", "gbk"):
            try:
                return normalize_text(content.decode(encoding))
            except UnicodeDecodeError:
                continue
        raise ExtractionError("Unable to decode text file content")

    @staticmethod
    def _extract_pdf(content: bytes) -> str:
        reader = PdfReader(BytesIO(content))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        if not text.strip():
            raise ExtractionError("PDF text extraction returned empty content")
        return normalize_text(text)

    @staticmethod
    def _extract_docx(content: bytes) -> str:
        document = DocxDocument(BytesIO(content))
        text = "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text.strip())
        if not text.strip():
            raise ExtractionError("DOCX text extraction returned empty content")
        return normalize_text(text)
