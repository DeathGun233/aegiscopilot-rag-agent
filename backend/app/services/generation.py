from __future__ import annotations

import json
from collections.abc import Generator
from urllib import request

from ..config import settings
from ..models import RetrievalResult


class GenerationService:
    def __init__(self) -> None:
        self.provider = settings.llm_provider
        self.model = settings.llm_model

    def generate(
        self,
        *,
        query: str,
        intent: str,
        retrieval_results: list[RetrievalResult],
        conversation_summary: str,
    ) -> str:
        if self.provider == "openai-compatible" and settings.llm_base_url and settings.llm_api_key:
            try:
                return self._call_openai_compatible(
                    query=query,
                    intent=intent,
                    retrieval_results=retrieval_results,
                    conversation_summary=conversation_summary,
                )
            except Exception:
                return self._mock_generate(query, intent, retrieval_results, conversation_summary)
        return self._mock_generate(query, intent, retrieval_results, conversation_summary)

    def stream_generate(
        self,
        *,
        query: str,
        intent: str,
        retrieval_results: list[RetrievalResult],
        conversation_summary: str,
    ) -> Generator[str, None, None]:
        if self.provider == "openai-compatible" and settings.llm_base_url and settings.llm_api_key:
            try:
                yield from self._call_openai_compatible_stream(
                    query=query,
                    intent=intent,
                    retrieval_results=retrieval_results,
                    conversation_summary=conversation_summary,
                )
                return
            except Exception:
                pass
        text = self._mock_generate(query, intent, retrieval_results, conversation_summary)
        for chunk in self._chunk_text(text):
            yield chunk

    def _mock_generate(
        self,
        query: str,
        intent: str,
        retrieval_results: list[RetrievalResult],
        conversation_summary: str,
    ) -> str:
        lines = []
        if retrieval_results:
            source_titles = "、".join(result.document_title for result in retrieval_results[:2])
            lines.append(f"基于 {source_titles}，我给出简要结论如下：")
            for result in retrieval_results[:2]:
                lines.append(f"- {result.text[:70]}")
        else:
            lines.append("当前知识库证据不足，建议补充文档或细化问题。")
        return "\n".join(lines)

    def _call_openai_compatible(
        self,
        *,
        query: str,
        intent: str,
        retrieval_results: list[RetrievalResult],
        conversation_summary: str,
    ) -> str:
        prompt = {
            "task": "请基于证据简洁回答用户问题",
            "intent": intent,
            "query": query,
            "conversation_summary": conversation_summary,
            "evidence": [
                {
                    "source": item.source,
                    "document_title": item.document_title,
                    "text": item.text,
                    "score": item.score,
                }
                for item in retrieval_results[:2]
            ],
            "requirements": [
                "只使用给定证据，不要编造",
                "用中文回答",
                "尽量控制在3句话以内，优先短段落或2-3个要点",
                "不要输出“问题类型、上下文摘要、证据片段、建议”等提示词标签",
                "如果证据不足，明确说信息不足",
            ],
        }
        payload = json.dumps(
            {
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "你是企业知识库助手。"
                            "回答必须基于证据，语言简洁、直接、自然。"
                            "不要复述提示，不要输出调试信息，不要展开无关文档。"
                        ),
                    },
                    {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
                ],
                "temperature": 0.2,
            }
        ).encode("utf-8")
        req = request.Request(
            url=f"{settings.llm_base_url.rstrip('/')}/chat/completions",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.llm_api_key}",
            },
            method="POST",
        )
        with request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"]

    def _call_openai_compatible_stream(
        self,
        *,
        query: str,
        intent: str,
        retrieval_results: list[RetrievalResult],
        conversation_summary: str,
    ) -> Generator[str, None, None]:
        prompt = {
            "task": "请基于证据简洁回答用户问题",
            "intent": intent,
            "query": query,
            "conversation_summary": conversation_summary,
            "evidence": [
                {
                    "source": item.source,
                    "document_title": item.document_title,
                    "text": item.text,
                    "score": item.score,
                }
                for item in retrieval_results[:2]
            ],
            "requirements": [
                "只使用给定证据，不要编造",
                "用中文回答",
                "尽量控制在3句话以内，优先短段落或2-3个要点",
                "不要输出提示词标签或调试信息",
                "如果证据不足，明确说信息不足",
            ],
        }
        payload = json.dumps(
            {
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "你是企业知识库助手。"
                            "回答必须基于证据，语言简洁、直接、自然。"
                            "不要复述提示，不要输出调试信息，不要展开无关文档。"
                        ),
                    },
                    {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
                ],
                "temperature": 0.2,
                "stream": True,
            }
        ).encode("utf-8")
        req = request.Request(
            url=f"{settings.llm_base_url.rstrip('/')}/chat/completions",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.llm_api_key}",
            },
            method="POST",
        )
        with request.urlopen(req, timeout=60) as response:
            for raw_line in response:
                line = raw_line.decode("utf-8").strip()
                if not line or not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                payload = json.loads(data)
                delta = payload["choices"][0].get("delta", {}).get("content")
                if isinstance(delta, str) and delta:
                    yield delta

    @staticmethod
    def _chunk_text(text: str, chunk_size: int = 24) -> Generator[str, None, None]:
        for start in range(0, len(text), chunk_size):
            yield text[start : start + chunk_size]
