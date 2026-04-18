from __future__ import annotations

import json
from pathlib import Path

from ..config import settings
from ..models import ModelCatalog, ModelOption
from ..sql_repositories import SqlRuntimeSettingsRepository


class RuntimeModelService:
    def __init__(
        self,
        storage_path: Path,
        runtime_store: SqlRuntimeSettingsRepository | None = None,
    ) -> None:
        self.storage_path = storage_path
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        self.runtime_store = runtime_store
        self._options = [
            ModelOption(
                id="qwen3-max",
                label="qwen3-max",
                tier="flagship",
                description="Best quality for multi-step reasoning and polished answers.",
                recommended_for="Interview demos, enterprise QA, and complex multi-hop synthesis.",
            ),
            ModelOption(
                id="qwen-max",
                label="qwen-max",
                tier="high",
                description="Strong general-purpose model with solid reasoning depth.",
                recommended_for="Daily enterprise assistant use when quality matters.",
            ),
            ModelOption(
                id="qwen-plus",
                label="qwen-plus",
                tier="balanced",
                description="Balanced latency and answer quality for most RAG chats.",
                recommended_for="Default knowledge-base Q&A and routine summaries.",
            ),
            ModelOption(
                id="qwen-turbo",
                label="qwen-turbo",
                tier="fast",
                description="Fast and economical option for lightweight tasks.",
                recommended_for="High-frequency chat and quick drafts.",
            ),
        ]
        self._allowed = {item.id for item in self._options}

    def get_runtime(self) -> dict[str, object]:
        return {
            "provider": settings.llm_provider,
            "base_url": settings.llm_base_url,
            "model": self.get_active_model(),
            "api_key_configured": bool(settings.llm_api_key),
        }

    def get_catalog(self) -> ModelCatalog:
        runtime = self.get_runtime()
        return ModelCatalog(
            provider=str(runtime["provider"]),
            base_url=str(runtime["base_url"]),
            active_model=str(runtime["model"]),
            api_key_configured=bool(runtime["api_key_configured"]),
            options=self._options,
        )

    def get_active_model(self) -> str:
        payload = self._load_payload()
        active_model = payload.get("active_model", settings.llm_model)
        return active_model if active_model in self._allowed else settings.llm_model

    def select_model(self, model_id: str) -> ModelCatalog:
        if model_id not in self._allowed:
            raise ValueError(f"unsupported model: {model_id}")
        payload = {"active_model": model_id}
        if self.runtime_store:
            self.runtime_store.set("runtime_model", payload)
        else:
            self.storage_path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        return self.get_catalog()

    def _load_payload(self) -> dict[str, object]:
        if self.runtime_store:
            payload = self.runtime_store.get("runtime_model")
            if payload:
                return payload
        if not self.storage_path.exists():
            return {}
        try:
            return json.loads(self.storage_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
