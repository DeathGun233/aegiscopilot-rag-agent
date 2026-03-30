from __future__ import annotations

from pydantic import BaseModel, Field

from .models import AgentTask, Conversation, Document, EvaluationRun, Message, RetrievalResult, SystemStats


class DocumentSummary(Document):
    chunk_count: int = 0
    indexed: bool = False
    indexed_label: str = "Not Indexed"


class ChatRequest(BaseModel):
    query: str = Field(min_length=1)
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    conversation: Conversation
    reply: Message
    task: AgentTask


class ConversationCreateRequest(BaseModel):
    title: str = "新对话"


class DocumentCreateRequest(BaseModel):
    title: str
    content: str
    source_type: str = "text"
    department: str = "general"
    version: str = "v1"
    tags: list[str] = Field(default_factory=list)


class DocumentListResponse(BaseModel):
    documents: list[DocumentSummary]


class IndexResponse(BaseModel):
    document_id: str
    chunks_created: int


class ConversationListResponse(BaseModel):
    conversations: list[Conversation]


class RetrievalPreviewRequest(BaseModel):
    query: str
    top_k: int | None = None


class RetrievalPreviewResponse(BaseModel):
    results: list[RetrievalResult]


class EvaluationResponse(BaseModel):
    run: EvaluationRun


class SystemStatsResponse(BaseModel):
    stats: SystemStats
