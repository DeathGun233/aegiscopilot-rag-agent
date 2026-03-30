from __future__ import annotations

from functools import lru_cache

from pathlib import Path

from .config import settings
from .repositories import ConversationRepository, DocumentRepository, JsonStore, TaskRepository
from .services.agent import AgentService
from .services.documents import DocumentService
from .services.extraction import ExtractionService
from .services.generation_service import GenerationService
from .services.retrieval import RetrievalService
from .services.runtime_models import RuntimeModelService
from .services.system import SystemService
from .services.tools import ToolService


class Container:
    def __init__(self) -> None:
        storage = Path(settings.storage_dir)
        self.conversations = ConversationRepository(JsonStore(storage / "conversations.json"))
        self.documents = DocumentRepository(
            JsonStore(storage / "documents.json"),
            JsonStore(storage / "chunks.json"),
        )
        self.tasks = TaskRepository(JsonStore(storage / "tasks.json"))
        self.document_service = DocumentService(self.documents)
        self.extraction_service = ExtractionService()
        self.retrieval_service = RetrievalService(self.documents)
        self.tool_service = ToolService(self.retrieval_service)
        self.runtime_model_service = RuntimeModelService(storage / "runtime_model.json")
        self.generation_service = GenerationService(self.runtime_model_service)
        self.agent_service = AgentService(
            retrieval=self.retrieval_service,
            tools=self.tool_service,
            tasks=self.tasks,
            generation=self.generation_service,
        )
        self.system_service = SystemService(
            self.conversations,
            self.documents,
            self.tasks,
            self.runtime_model_service,
        )


@lru_cache(maxsize=1)
def get_container() -> Container:
    return Container()
