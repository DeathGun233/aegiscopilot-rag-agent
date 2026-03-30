from __future__ import annotations

from datetime import datetime, timezone

from ..models import Chunk, Document
from ..repositories import DocumentRepository
from .text import normalize_text, split_into_chunks, tokenize


class DocumentService:
    def __init__(self, repo: DocumentRepository) -> None:
        self.repo = repo

    def create_document(
        self,
        *,
        title: str,
        content: str,
        source_type: str,
        department: str,
        version: str,
        tags: list[str],
    ) -> Document:
        document = Document(
            title=title,
            content=normalize_text(content),
            source_type=source_type,
            department=department,
            version=version,
            tags=tags,
        )
        return self.repo.upsert_document(document)

    def list_documents(self) -> list[Document]:
        return self.repo.list_documents()

    def get_document(self, document_id: str) -> Document | None:
        return self.repo.get_document(document_id)

    def delete_document(self, document_id: str) -> bool:
        return self.repo.delete_document(document_id)

    def index_document(self, document_id: str) -> int:
        document = self.repo.get_document(document_id)
        if document is None:
            raise KeyError(document_id)
        chunks = [
            Chunk(
                document_id=document.id,
                document_title=document.title,
                text=chunk_text,
                chunk_index=index,
                tokens=tokenize(chunk_text),
                metadata={
                    "department": document.department,
                    "version": document.version,
                    "tags": document.tags,
                },
            )
            for index, chunk_text in enumerate(split_into_chunks(document.content))
        ]
        document.indexed_at = datetime.now(timezone.utc)
        self.repo.upsert_document(document)
        return self.repo.replace_chunks(document.id, chunks)
