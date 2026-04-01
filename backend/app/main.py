from __future__ import annotations

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from .api_schemas import (
    AgentTaskDetailResponse,
    AgentTaskListResponse,
    AgentTaskSummary,
    ChatRequest,
    ChatResponse,
    ConversationCreateRequest,
    ConversationListResponse,
    CurrentUserResponse,
    DocumentCreateRequest,
    DocumentDetailResponse,
    DocumentListResponse,
    DocumentStatusResponse,
    DocumentSummary,
    DocumentTaskResponse,
    DocumentTaskSummary,
    DocumentUploadResponse,
    EvaluationResponse,
    IndexResponse,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    ModelCatalogResponse,
    ModelSelectRequest,
    ReindexResponse,
    RetrievalPreviewRequest,
    RetrievalPreviewResponse,
    RetrievalSettingsResponse,
    RetrievalSettingsUpdateRequest,
    SystemStatsResponse,
    QueryUnderstandingPreview,
    UserListResponse,
)
from .config import settings
from .deps import get_container, get_current_user
from .models import (
    AgentTask,
    Document,
    DocumentIndexState,
    DocumentTask,
    DocumentTaskKind,
    DocumentTaskStatus,
    Intent,
    Message,
    MessageRole,
    RetrievalSettings,
    User,
    UserRole,
)
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录")
    return token


def _friendly_source_type(source_type: str) -> str:
    normalized = source_type.strip().lower()
    return {
        "upload": "上传文件",
        "seed": "示例文档",
        "text": "手动录入",
        "pdf": "PDF",
        "docx": "Word",
        "markdown": "Markdown",
    }.get(normalized, source_type.replace("_", " ").title())


def _friendly_index_state(index_state: DocumentIndexState) -> str:
    return {
        DocumentIndexState.pending: "待索引",
        DocumentIndexState.indexing: "索引中",
        DocumentIndexState.indexed: "已索引",
        DocumentIndexState.failed: "索引失败",
    }[index_state]


def _friendly_task_kind(kind: DocumentTaskKind) -> str:
    return {
        DocumentTaskKind.upload: "上传入库",
        DocumentTaskKind.reindex: "重建索引",
    }[kind]


def _friendly_task_status(status_value: DocumentTaskStatus) -> str:
    return {
        DocumentTaskStatus.pending: "等待中",
        DocumentTaskStatus.running: "执行中",
        DocumentTaskStatus.succeeded: "已完成",
        DocumentTaskStatus.failed: "失败",
    }[status_value]


def _build_task_summary(task: DocumentTask | None) -> DocumentTaskSummary | None:
    if task is None:
        return None
    return DocumentTaskSummary(
        **task.model_dump(mode="json"),
        kind_label=_friendly_task_kind(task.kind),
        status_label=_friendly_task_status(task.status),
    )


def _build_document_summary(document: Document, chunk_count: int, task: DocumentTask | None = None) -> DocumentSummary:
    indexed = document.index_state == DocumentIndexState.indexed and bool(document.indexed_at)
    preview = normalize_text(document.content)[:160]
    if document.index_state == DocumentIndexState.indexed:
        indexed_label = f"已索引，共 {chunk_count} 个片段"
    elif document.index_state == DocumentIndexState.failed and document.last_index_error:
        indexed_label = f"索引失败：{document.last_index_error}"
    elif document.index_state == DocumentIndexState.indexing:
        indexed_label = "索引任务进行中"
    else:
        indexed_label = "尚未建立索引"

    return DocumentSummary(
        **document.model_dump(mode="json"),
        chunk_count=chunk_count,
        indexed=indexed,
        index_state_label=_friendly_index_state(document.index_state),
        indexed_label=indexed_label,
        source_label=f"{_friendly_source_type(document.source_type)} / {document.department}",
        tag_count=len(document.tags),
        content_preview=preview,
        last_task=_build_task_summary(task),
    )


def _document_matches(
    summary: DocumentSummary,
    *,
    query: str | None,
    department: str | None,
    source_type: str | None,
    index_state: str | None,
    indexed: bool | None,
    tag: str | None,
) -> bool:
    if department and summary.department.lower() != department.strip().lower():
        return False
    if source_type and summary.source_type.lower() != source_type.strip().lower():
        return False
    if index_state and summary.index_state.value != index_state.strip().lower():
        return False
    if indexed is not None and summary.indexed != indexed:
        return False
    if tag:
        needle = tag.strip().lower()
        if not any(needle in item.lower() for item in summary.tags):
            return False
    if query:
        needle = normalize_text(query).lower()
        haystack = " ".join(
            [
                summary.title,
                summary.content,
                summary.department,
                summary.source_type,
                summary.version,
                summary.index_state.value,
                " ".join(summary.tags),
            ]
        ).lower()
        if needle not in haystack:
            return False
    return True


def _sort_documents(documents: list[DocumentSummary], sort_by: str) -> list[DocumentSummary]:
    key = sort_by.strip().lower()
    if key == "title_asc":
        return sorted(documents, key=lambda item: item.title.lower())
    if key == "title_desc":
        return sorted(documents, key=lambda item: item.title.lower(), reverse=True)
    if key == "created_asc":
        return sorted(documents, key=lambda item: item.created_at)
    if key == "created_desc":
        return sorted(documents, key=lambda item: item.created_at, reverse=True)
    return sorted(documents, key=lambda item: (item.updated_at, item.title.lower()), reverse=True)


def _ensure_conversation_owner(conversation, current_user: User) -> None:
    if conversation.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在")


def _ensure_task_owner(task, current_user: User) -> None:
    if task.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
