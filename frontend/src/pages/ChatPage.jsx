import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChatComposer } from "../components/chat/ChatComposer";
import { MessageList } from "../components/chat/MessageList";
import { useAppContext } from "../context/AppContext";
import { fetchJson, streamChat } from "../lib/api";

const starterPrompts = [
  "员工请假需要提前多久申请？",
  "生产发布前需要准备什么？",
  "请总结差旅报销流程。",
  "跨境电商公司在个人信息保护方面要注意哪些问题？",
];

const scenarioCards = [
  {
    title: "制度问答",
    description: "围绕企业制度、流程和内部规范快速检索。",
    prompt: "员工请假需要提前多久申请？",
  },
  {
    title: "流程总结",
    description: "基于知识库生成更结构化、更适合执行的结论。",
    prompt: "请总结差旅报销流程。",
  },
  {
    title: "发布检查",
    description: "把发布类问题转成上线前检查清单。",
    prompt: "生产发布前需要准备什么？",
  },
];

export function ChatPage() {
  const navigate = useNavigate();
  const params = useParams();
  const { conversationId: routeConversationId } = params;
  const { conversations, currentUserId, refreshConversations, refreshStats } = useAppContext();
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState("");
  const [citationMap, setCitationMap] = useState({});

  const currentConversation = useMemo(
    () => conversations.find((item) => item.id === routeConversationId) || null,
    [conversations, routeConversationId],
  );

  useEffect(() => {
    if (routeConversationId && currentConversation) {
      setMessages(currentConversation.messages || []);
      setCitationMap({});
      setStreamStatus("");
      return;
    }
    if (!routeConversationId) {
      setMessages([]);
      setCitationMap({});
      setStreamStatus("");
      return;
    }

    fetchJson(`/conversations/${routeConversationId}`, { userId: currentUserId })
      .then((data) => {
        setMessages(data.conversation.messages || []);
      })
      .catch(() => {
        navigate("/chat");
      });
  }, [currentConversation, currentUserId, navigate, routeConversationId]);

  async function handleSendMessage(event) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isStreaming) {
      return;
    }

    const assistantId = `assistant-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", content: trimmed },
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setIsStreaming(true);
    setStreamStatus("正在连接模型...");
    setQuery("");
    setCitationMap((current) => ({ ...current, [assistantId]: [] }));

    let nextConversationId = routeConversationId || null;
    let answer = "";

    try {
      await streamChat(
        { query: trimmed, conversationId: routeConversationId },
        currentUserId,
        {
          onConversation(payload) {
            nextConversationId = payload.conversation_id;
          },
          onStatus(payload) {
            setStreamStatus(payload.message);
          },
          onDelta(payload) {
            answer += payload.content;
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, content: answer } : message,
              ),
            );
          },
          onDone(payload) {
            if (payload.task?.citations?.length) {
              setCitationMap((current) => ({
                ...current,
                [assistantId]: payload.task.citations,
              }));
            }
          },
        },
      );

      const nextConversations = await refreshConversations();
      await refreshStats();
      if (nextConversationId) {
        navigate(`/chat/${nextConversationId}`);
        const synced = nextConversations.find((item) => item.id === nextConversationId);
        if (synced) {
          setMessages(synced.messages || []);
        }
      }
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, content: "连接模型失败，请稍后重试。" }
            : message,
        ),
      );
      setStreamStatus(error.message || "连接模型失败");
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="page chat-page">
      <header className="page-header">
        <div>
          <span className="page-kicker">AegisCopilot / Chat</span>
          <h1>{currentConversation?.title || "新对话"}</h1>
        </div>
      </header>

      <section className="chat-hero">
        <div className="hero-copy">
          <span className="hero-pill">RAG 智能问答</span>
          <h2>把问题变成清晰答案</h2>
          <p>结构化提问、知识检索与流式回答，适合企业知识库问答和制度场景。</p>
        </div>

        <ChatComposer
          query={query}
          onQueryChange={setQuery}
          onSubmit={handleSendMessage}
          isStreaming={isStreaming}
          streamStatus={streamStatus}
          starterPrompts={starterPrompts}
        />

        <div className="scenario-grid">
          {scenarioCards.map((item) => (
            <button
              key={item.title}
              type="button"
              className="scenario-tile"
              onClick={() => setQuery(item.prompt)}
            >
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <small>{item.prompt}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="thread-panel">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">Conversation</span>
            <h3>会话内容</h3>
          </div>
          <span className={isStreaming ? "status-dot live" : "status-dot"}>Streaming</span>
        </div>
        <MessageList messages={messages} citationMap={citationMap} />
      </section>
    </div>
  );
}
