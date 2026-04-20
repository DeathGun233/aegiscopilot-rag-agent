from __future__ import annotations

from pathlib import Path

import pytest

from app.models import Chunk, Document, DocumentIndexState, utc_now
from app.repositories import DocumentRepository
from app.services.runtime_retrieval import RuntimeRetrievalService


class DisabledEmbeddings:
    def is_enabled(self) -> bool:
        return False

    def embed_text(self, text: str) -> list[float]:
        raise AssertionError("disabled embeddings should not embed text")

    def get_version(self) -> str:
        return "disabled"


class RejectingDocumentRepository:
    def list_chunks(self) -> list[Chunk]:
        raise AssertionError("retrieval should read candidates from vector store")


class StaticVectorStore:
    def __init__(self, chunks: list[Chunk]) -> None:
        self.chunks = chunks
        self.calls: list[dict[str, object]] = []

    def search_candidates(self, query: str, query_embedding: list[float], limit: int) -> list[Chunk]:
        self.calls.append({"query": query, "query_embedding": query_embedding, "limit": limit})
        return self.chunks


def test_retrieval_reads_candidates_from_vector_store(tmp_path: Path) -> None:
    from app.services.retrieval import RetrievalService

    chunk = Chunk(
        id="chunk-vector-1",
        document_id="doc-vector",
        document_title="Leave Policy",
        text="Employees submit leave requests one business day in advance.",
        chunk_index=0,
        tokens=["employees", "submit", "leave", "requests", "business", "day"],
        embedding=[],
        embedding_version="",
        metadata={"department": "hr"},
    )
    vector_store = StaticVectorStore([chunk])
    service = RetrievalService(
        repo=RejectingDocumentRepository(),
        vector_store=vector_store,
        runtime_retrieval=RuntimeRetrievalService(tmp_path / "runtime_retrieval.json"),
        embeddings=DisabledEmbeddings(),
    )

    results = service.search("leave requests")

    assert [item.chunk_id for item in results] == [chunk.id]
    assert vector_store.calls
    assert vector_store.calls[0]["query"] == "leave requests"


def test_local_vector_store_delegates_to_existing_chunk_storage() -> None:
    from app.vector_store import LocalVectorStore

    now = utc_now()
    repo = DocumentRepository()
    document = repo.upsert_document(
        Document(
            id="doc-local-vector",
            title="Local Vector",
            content="local vector fallback",
            created_at=now,
            updated_at=now,
            indexed_at=now,
            index_state=DocumentIndexState.indexed,
        )
    )
    chunk = Chunk(
        id="chunk-local-vector",
        document_id=document.id,
        document_title=document.title,
        text=document.content,
        chunk_index=0,
        tokens=["local", "vector", "fallback"],
        embedding=[0.1, 0.2],
        embedding_version="test-v1",
        metadata={},
    )
    vector_store = LocalVectorStore(repo)

    assert vector_store.replace_document_chunks(document.id, [chunk]) == 1
    assert vector_store.count_chunks_for_document(document.id) == 1
    assert vector_store.count_embedded_chunks_for_document(document.id) == 1
    assert vector_store.list_chunks_for_document(document.id)[0].id == chunk.id
    assert vector_store.search_candidates("local", [], limit=1)[0].id == chunk.id
    assert vector_store.delete_document(document.id) is True
    assert vector_store.count_chunks_for_document(document.id) == 0


def test_retrieval_requires_vector_store_argument(tmp_path: Path) -> None:
    from app.services.retrieval import RetrievalService

    with pytest.raises(TypeError):
        RetrievalService(  # type: ignore[call-arg]
            RejectingDocumentRepository(),
            RuntimeRetrievalService(tmp_path / "runtime_retrieval.json"),
            DisabledEmbeddings(),
        )
