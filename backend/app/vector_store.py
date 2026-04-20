from __future__ import annotations

from collections.abc import Iterable
from typing import Protocol

from .models import Chunk
from .repositories import DocumentRepository


class VectorStore(Protocol):
    def replace_document_chunks(self, document_id: str, chunks: Iterable[Chunk]) -> int:
        ...

    def delete_document(self, document_id: str) -> bool:
        ...

    def search_candidates(self, query: str, query_embedding: list[float], limit: int) -> list[Chunk]:
        ...

    def list_chunks(self) -> list[Chunk]:
        ...

    def list_chunks_for_document(self, document_id: str) -> list[Chunk]:
        ...

    def count_chunks_for_document(self, document_id: str) -> int:
        ...

    def count_embedded_chunks_for_document(self, document_id: str) -> int:
        ...

    def get_chunk_stats(self) -> dict[str, dict[str, int]]:
        ...


class LocalVectorStore:
    def __init__(self, repository: DocumentRepository) -> None:
        self.repository = repository

    def replace_document_chunks(self, document_id: str, chunks: Iterable[Chunk]) -> int:
        return self.repository.replace_chunks(document_id, chunks)

    def delete_document(self, document_id: str) -> bool:
        existing_count = self.repository.count_chunks_for_document(document_id)
        self.repository.replace_chunks(document_id, [])
        return existing_count > 0

    def search_candidates(self, query: str, query_embedding: list[float], limit: int) -> list[Chunk]:
        return self.repository.list_chunks()

    def list_chunks(self) -> list[Chunk]:
        return self.repository.list_chunks()

    def list_chunks_for_document(self, document_id: str) -> list[Chunk]:
        return self.repository.list_chunks_for_document(document_id)

    def count_chunks_for_document(self, document_id: str) -> int:
        return self.repository.count_chunks_for_document(document_id)

    def count_embedded_chunks_for_document(self, document_id: str) -> int:
        return self.repository.count_embedded_chunks_for_document(document_id)

    def get_chunk_stats(self) -> dict[str, dict[str, int]]:
        return self.repository.get_chunk_stats()
