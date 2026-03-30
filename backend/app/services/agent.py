from __future__ import annotations

from dataclasses import dataclass, field

from ..config import settings
from ..models import AgentTask, Conversation, Intent, Message, MessageRole, WorkflowStep
from ..repositories import TaskRepository
from .generation import GenerationService
from .retrieval import RetrievalService
from .tools import ToolService


@dataclass
class WorkflowContext:
    conversation: Conversation
    query: str
    intent: Intent | None = None
    route_reason: str = ""
    retrieval_results: list = field(default_factory=list)
    answer: str = ""
    grounded: bool = False
    trace: list[dict] = field(default_factory=list)


class AgentService:
    def __init__(
        self,
        *,
        retrieval: RetrievalService,
        tools: ToolService,
        tasks: TaskRepository,
        generation: GenerationService,
    ) -> None:
        self.retrieval = retrieval
        self.tools = tools
        self.tasks = tasks
        self.generation = generation

    def run(self, conversation: Conversation, query: str) -> tuple[Message, AgentTask]:
        context = WorkflowContext(conversation=conversation, query=query)
        steps = [
            WorkflowStep.intent_detect,
            WorkflowStep.retrieve_context,
            WorkflowStep.plan_response,
            WorkflowStep.tool_or_answer,
            WorkflowStep.response_grounding_check,
            WorkflowStep.final_response,
        ]

        self._detect_intent(context)
        self._retrieve_context(context)
        self._plan_response(context)
        self._tool_or_answer(context)
        self._grounding_check(context)
        reply = self._finalize(context)

        task = AgentTask(
            conversation_id=conversation.id,
            query=query,
            intent=context.intent or Intent.knowledge_qa,
            steps=steps,
            trace=context.trace,
            final_answer=reply.content,
            citations=context.retrieval_results,
            route_reason=context.route_reason,
            provider=self.generation.provider,
        )
        self.tasks.save(task)
        return reply, task

    def run_stream(self, conversation: Conversation, query: str):
        context = WorkflowContext(conversation=conversation, query=query)
        steps = [
            WorkflowStep.intent_detect,
            WorkflowStep.retrieve_context,
            WorkflowStep.plan_response,
            WorkflowStep.tool_or_answer,
            WorkflowStep.response_grounding_check,
            WorkflowStep.final_response,
        ]

        self._detect_intent(context)
        yield {"type": "status", "message": "正在识别问题意图..."}
        self._retrieve_context(context)
        yield {"type": "status", "message": "正在检索知识库..."}
        self._plan_response(context)
        yield {"type": "status", "message": "正在生成回答..."}

        if context.intent == Intent.chitchat:
            context.answer = "你好，我是 AegisCopilot。你可以问我企业制度、流程、产品文档或技术规范相关的问题。"
            yield {"type": "delta", "content": context.answer}
        else:
            supporting_results = self._select_supporting_results(context.retrieval_results)
            context.retrieval_results = supporting_results
            if supporting_results:
                stream = self.generation.stream_generate(
                    query=context.query,
                    intent=context.intent.value,
                    retrieval_results=supporting_results,
                    conversation_summary=self._summarize_history(context.conversation),
                )
                context.answer = ""
                for piece in stream:
                    context.answer += piece
                    yield {"type": "delta", "content": piece}
            else:
                context.answer = "知识库中没有足够证据支持这个问题的回答。请补充文档，或换个更具体的问题。"
                yield {"type": "delta", "content": context.answer}

        context.trace.append({"step": WorkflowStep.tool_or_answer, "answer_preview": context.answer[:180]})
        self._grounding_check(context)
        reply = self._finalize(context)
        task = AgentTask(
            conversation_id=conversation.id,
            query=query,
            intent=context.intent or Intent.knowledge_qa,
            steps=steps,
            trace=context.trace,
            final_answer=reply.content,
            citations=context.retrieval_results,
            route_reason=context.route_reason,
            provider=self.generation.provider,
        )
        self.tasks.save(task)
        yield {"type": "done", "reply": reply.model_dump(mode="json"), "task": task.model_dump(mode="json")}

    def _detect_intent(self, context: WorkflowContext) -> None:
        raw_query = context.query.lower()
        compact_query = raw_query.replace(" ", "")
        if any(word in compact_query for word in ["比较", "对比", "总结", "生成任务", "整理"]):
            context.intent = Intent.task
            context.route_reason = "The query contains decomposition or summarization language and should use a task-oriented path."
        elif any(word in compact_query for word in ["你好", "hello", "hi", "在吗"]):
            context.intent = Intent.chitchat
            context.route_reason = "The query is a greeting and can bypass retrieval."
        else:
            context.intent = Intent.knowledge_qa
            context.route_reason = "The query asks for knowledge grounded in internal documents."
        context.trace.append(
            {
                "step": WorkflowStep.intent_detect,
                "intent": context.intent,
                "route_reason": context.route_reason,
            }
        )

    def _retrieve_context(self, context: WorkflowContext) -> None:
        if context.intent == Intent.chitchat:
            context.retrieval_results = []
        else:
            context.retrieval_results = self.tools.knowledge_search(context.query)
        context.trace.append(
            {
                "step": WorkflowStep.retrieve_context,
                "hits": len(context.retrieval_results),
                "sources": [item.source for item in context.retrieval_results],
            }
        )

    def _plan_response(self, context: WorkflowContext) -> None:
        plan = {
            "step": WorkflowStep.plan_response,
            "strategy": (
                "direct_reply"
                if context.intent == Intent.chitchat
                else "tool_augmented_summary"
                if context.intent == Intent.task
                else "grounded_knowledge_answer"
            ),
            "use_citations": context.intent != Intent.chitchat,
            "retrieval_hits": len(context.retrieval_results),
        }
        context.trace.append(plan)

    def _tool_or_answer(self, context: WorkflowContext) -> None:
        if context.intent == Intent.chitchat:
            context.answer = "你好，我是 AegisCopilot。你可以问我企业制度、流程、产品文档或技术规范相关的问题。"
        elif context.intent == Intent.task and "总结" in context.query:
            supporting_results = self._select_supporting_results(context.retrieval_results)
            generated = self.generation.generate(
                query=context.query,
                intent=context.intent.value,
                retrieval_results=supporting_results,
                conversation_summary=self._summarize_history(context.conversation),
            )
            context.retrieval_results = supporting_results
            context.answer = generated
        elif context.retrieval_results:
            supporting_results = self._select_supporting_results(context.retrieval_results)
            generated = self.generation.generate(
                query=context.query,
                intent=context.intent.value,
                retrieval_results=supporting_results,
                conversation_summary=self._summarize_history(context.conversation),
            )
            context.answer = generated
            context.retrieval_results = supporting_results
        else:
            context.answer = "知识库中没有足够证据支持这个问题的回答。请补充文档，或换个更具体的问题。"
        context.trace.append({"step": WorkflowStep.tool_or_answer, "answer_preview": context.answer[:180]})

    def _grounding_check(self, context: WorkflowContext) -> None:
        score = context.retrieval_results[0].score if context.retrieval_results else 0.0
        context.grounded = score >= settings.min_grounding_score or context.intent == Intent.chitchat
        if not context.grounded and context.intent != Intent.chitchat:
            context.answer = "已检索到少量相关内容，但证据不足以给出可靠结论。建议进一步缩小问题范围或补充内部资料。"
        context.trace.append(
            {
                "step": WorkflowStep.response_grounding_check,
                "grounded": context.grounded,
                "top_score": score,
            }
        )

    def _finalize(self, context: WorkflowContext) -> Message:
        reply = Message(role=MessageRole.assistant, content=context.answer)
        context.trace.append({"step": WorkflowStep.final_response, "message_id": reply.id})
        return reply

    @staticmethod
    def _summarize_history(conversation: Conversation) -> str:
        relevant = [message.content for message in conversation.messages[-settings.max_history_messages :]]
        return " | ".join(relevant[-4:])

    @staticmethod
    def _synthesize_answer(query: str, results: list) -> str:
        top = results[0]
        if "请假" in query:
            return f"根据 {top.document_title}，请假通常需要提前提交申请，并按照审批流程完成直属主管与 HR 审批。"
        if "报销" in query:
            return f"根据 {top.document_title}，报销流程通常包含票据上传、主管审批、财务复核与打款。"
        if "发布" in query or "上线" in query:
            return f"根据 {top.document_title}，上线发布前应完成测试、回滚预案、审批与变更通知。"
        return f"问题“{query}”的相关答案主要集中在 {top.document_title}，建议结合引用片段核对具体细节。"

    @staticmethod
    def _select_supporting_results(results: list) -> list:
        if not results:
            return []
        top_score = results[0].score
        threshold = max(settings.min_grounding_score, top_score * 0.6)
        filtered = [item for item in results if item.score >= threshold]
        return filtered[:2] or results[:1]

    @staticmethod
    def _format_citations(results: list) -> str:
        return "\n".join(
            f"- {AgentService._humanize_source(result)}" for result in results
        )

    @staticmethod
    def _humanize_source(result) -> str:
        return result.display_source or f"{result.document_title} | 片段 1"
