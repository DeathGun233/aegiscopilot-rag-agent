from __future__ import annotations

import json

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .api_schemas import (
    ChatRequest,
    ChatResponse,
    ConversationCreateRequest,
    ConversationListResponse,
    DocumentCreateRequest,
    DocumentListResponse,
    EvaluationResponse,
    IndexResponse,
    ModelCatalogResponse,
    ModelSelectRequest,
    CurrentUserResponse,
    UserListResponse,
    RetrievalPreviewRequest,
    RetrievalPreviewResponse,
    SystemStatsResponse,
)
from .config import settings
from .deps import get_container, get_current_user
from .models import Message, MessageRole, User, UserRole
from .seed import main as seed_sample_documents
from .services.evaluation import EvaluationService
from .services.extraction import ExtractionError
from .services.streaming import sse_event, stream_response
from .services.text import normalize_text

app = FastAPI(title=settings.app_name, version=settings.app_version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
        "http://127.0.0.1:5175",
        "http://localhost:5175",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
seed_sample_documents()


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "AegisCopilot API is running", "environment": settings.environment}


@app.get("/health")
def health() -> dict[str, str]:
    container = get_container()
    runtime = container.runtime_model_service.get_runtime()
    return {"status": "ok", "provider": str(runtime["provider"]), "model": str(runtime["model"])}


def _require_admin(user: User) -> None:
    if user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="admin access required")


@app.get("/system/stats", response_model=SystemStatsResponse)
def get_system_stats() -> SystemStatsResponse:
    container = get_container()
    return SystemStatsResponse(stats=container.system_service.get_stats())


@app.get("/users", response_model=UserListResponse)
def list_users() -> UserListResponse:
    container = get_container()
    return UserListResponse(users=container.user_service.list_users())


@app.get("/users/me", response_model=CurrentUserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> CurrentUserResponse:
    return CurrentUserResponse(user=current_user)


@app.get("/models", response_model=ModelCatalogResponse)
def get_model_catalog() -> ModelCatalogResponse:
    container = get_container()
    return ModelCatalogResponse(catalog=container.runtime_model_service.get_catalog())


@app.post("/models/select", response_model=ModelCatalogResponse)
def select_model(
    request: ModelSelectRequest,
    current_user: User = Depends(get_current_user),
) -> ModelCatalogResponse:
    container = get_container()
    _require_admin(current_user)
    try:
        catalog = container.runtime_model_service.select_model(request.model_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ModelCatalogResponse(catalog=catalog)


@app.get("/conversations", response_model=ConversationListResponse)
def list_conversations() -> ConversationListResponse:
    container = get_container()
    return ConversationListResponse(conversations=container.conversations.list())


@app.post("/conversations", response_model=dict)
def create_conversation(request: ConversationCreateRequest) -> dict:
    container = get_container()
    conversation = container.conversations.create(title=request.title)
    return {"conversation": conversation}


@app.get("/conversations/{conversation_id}", response_model=dict)
def get_conversation(conversation_id: str) -> dict:
    container = get_container()
    conversation = container.conversations.get(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="conversation not found")
    return {"conversation": conversation}


@app.delete("/conversations/{conversation_id}", response_model=dict)
def delete_conversation(conversation_id: str) -> dict:
    container = get_container()
    deleted = container.conversations.delete(conversation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="conversation not found")
    return {"deleted": True, "conversation_id": conversation_id}


@app.get("/documents", response_model=DocumentListResponse)
def list_documents() -> DocumentListResponse:
    container = get_container()
    chunks = container.documents.list_chunks()
    counts: dict[str, int] = {}
    for chunk in chunks:
        counts[chunk.document_id] = counts.get(chunk.document_id, 0) + 1
    documents = []
    for document in container.document_service.list_documents():
        chunk_count = counts.get(document.id, 0)
        documents.append(
            {
                **document.model_dump(mode="json"),
                "chunk_count": chunk_count,
                "indexed": bool(document.indexed_at),
                "indexed_label": f"{chunk_count} chunks indexed" if chunk_count else "Not indexed yet",
            }
        )
    return DocumentListResponse(documents=documents)


@app.post("/documents", response_model=dict)
def create_document(
    request: DocumentCreateRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    container = get_container()
    _require_admin(current_user)
    document = container.document_service.create_document(**request.model_dump())
    return {"document": document}


@app.delete("/documents/{document_id}", response_model=dict)
def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    container = get_container()
    _require_admin(current_user)
    deleted = container.document_service.delete_document(document_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="document not found")
    return {"deleted": True, "document_id": document_id}


@app.post("/documents/upload", response_model=dict)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> dict:
    container = get_container()
    _require_admin(current_user)
    raw = await file.read()
    try:
        content = container.extraction_service.extract(file.filename or "uploaded-file", raw)
    except ExtractionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    document = container.document_service.create_document(
        title=file.filename or "uploaded-file",
        content=normalize_text(content),
        source_type="upload",
        department="general",
        version="v1",
        tags=[],
    )
    chunks_created = container.document_service.index_document(document.id)
    return {"document": document, "chunks_created": chunks_created}


@app.post("/documents/index", response_model=IndexResponse)
def index_document(
    payload: dict[str, str],
    current_user: User = Depends(get_current_user),
) -> IndexResponse:
    container = get_container()
    _require_admin(current_user)
    document_id = payload.get("document_id")
    if not document_id:
        raise HTTPException(status_code=400, detail="document_id is required")
    try:
        chunks_created = container.document_service.index_document(document_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="document not found") from exc
    return IndexResponse(document_id=document_id, chunks_created=chunks_created)


@app.post("/retrieval/preview", response_model=RetrievalPreviewResponse)
def preview_retrieval(request: RetrievalPreviewRequest) -> RetrievalPreviewResponse:
    container = get_container()
    return RetrievalPreviewResponse(results=container.retrieval_service.search(request.query, request.top_k))


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    container = get_container()
    if request.conversation_id:
        conversation = container.conversations.get(request.conversation_id)
        if conversation is None:
            raise HTTPException(status_code=404, detail="conversation not found")
    else:
        conversation = container.conversations.create(title=request.query[:24])

    user_message = Message(role=MessageRole.user, content=request.query)
    container.conversations.append_message(conversation.id, user_message)
    reply, task = container.agent_service.run(conversation, request.query)
    container.conversations.append_message(conversation.id, reply)
    return ChatResponse(conversation=conversation, reply=reply, task=task)


@app.post("/chat/stream")
def chat_stream(request: ChatRequest):
    container = get_container()
    if request.conversation_id:
        conversation = container.conversations.get(request.conversation_id)
        if conversation is None:
            raise HTTPException(status_code=404, detail="conversation not found")
    else:
        conversation = container.conversations.create(title=request.query[:24])

    user_message = Message(role=MessageRole.user, content=request.query)
    container.conversations.append_message(conversation.id, user_message)

    def event_generator():
        yield sse_event("conversation", {"conversation_id": conversation.id})
        for event in container.agent_service.run_stream(conversation, request.query):
            if event["type"] == "done":
                reply = Message.model_validate(event["reply"])
                container.conversations.append_message(conversation.id, reply)
            yield sse_event(event["type"], event)

    return stream_response(event_generator())


@app.get("/tasks/{task_id}", response_model=dict)
def get_task(task_id: str) -> dict:
    container = get_container()
    task = container.tasks.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="task not found")
    return {"task": task}


@app.post("/evaluate/run", response_model=EvaluationResponse)
def run_evaluation() -> EvaluationResponse:
    container = get_container()
    service = EvaluationService(container.agent_service, container.conversations)
    return EvaluationResponse(run=service.run())
