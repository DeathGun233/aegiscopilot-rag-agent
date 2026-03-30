import { useEffect, useState } from "react";

const apiBase = "http://127.0.0.1:8002";
const tabs = [
  { id: "knowledge", label: "知识库" },
  { id: "chat", label: "聊天" },
  { id: "evaluation", label: "评估" },
];
const starterPrompts = [
  "员工请假需要提前多久申请？",
  "请总结差旅报销流程",
  "生产发布前需要准备什么？",
  "跨境电商公司在个人信息保护方面要注意哪些问题？",
];

async function fetchJson(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AppNext() {
  const [activeTab, setActiveTab] = useState("chat");
  const [documents, setDocuments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [stats, setStats] = useState(null);
  const [modelCatalog, setModelCatalog] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [evaluation, setEvaluation] = useState(null);
  const [streamStatus, setStreamStatus] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [citationMap, setCitationMap] = useState({});
  const [uploadStatus, setUploadStatus] = useState("");

  async function refreshDashboard() {
    const [docsData, statsData, conversationsData, modelsData] = await Promise.all([
      fetchJson("/documents"),
      fetchJson("/system/stats"),
      fetchJson("/conversations"),
      fetchJson("/models"),
    ]);
    const orderedConversations = [...conversationsData.conversations].sort(
      (left, right) => new Date(right.updated_at) - new Date(left.updated_at),
    );
    setDocuments(docsData.documents);
    setStats(statsData.stats);
    setModelCatalog(modelsData.catalog);
    setConversations(orderedConversations);
    if (!conversationId && orderedConversations.length) {
      const latest = orderedConversations[0];
      setConversationId(latest.id);
      setMessages(latest.messages || []);
    }
  }

  useEffect(() => {
    refreshDashboard().catch(console.error);
  }, []);

  async function handleCreateConversation() {
    const data = await fetchJson("/conversations", {
      method: "POST",
      body: JSON.stringify({ title: "新对话" }),
    });
    setConversationId(data.conversation.id);
    setMessages([]);
    setCitationMap({});
    setActiveTab("chat");
    await refreshDashboard();
  }

  function handleSelectConversation(conversation) {
    setConversationId(conversation.id);
    setMessages(conversation.messages || []);
    setCitationMap({});
    setActiveTab("chat");
  }

  async function handleDeleteConversation(targetId) {
    await fetchJson(`/conversations/${targetId}`, { method: "DELETE" });
    if (targetId === conversationId) {
      setConversationId(null);
      setMessages([]);
      setCitationMap({});
    }
    await refreshDashboard();
  }

  async function handleModelChange(event) {
    const data = await fetchJson("/models/select", {
      method: "POST",
      body: JSON.stringify({ model_id: event.target.value }),
    });
    setModelCatalog(data.catalog);
    await refreshDashboard();
  }

  async function handleUploadDocument(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadStatus("正在解析并索引文档...");
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${apiBase}/documents/upload`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      setUploadStatus("文档上传失败，请检查文件格式。");
      return;
    }
    await response.json();
    setUploadStatus(`已完成文档解析：${file.name}`);
    await refreshDashboard();
    setActiveTab("knowledge");
  }

  async function handleDeleteDocument(documentId) {
    await fetchJson(`/documents/${documentId}`, { method: "DELETE" });
    setUploadStatus("文档已从知识库删除");
    await refreshDashboard();
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    if (!query.trim() || isStreaming) return;

    const currentQuery = query;
    const userMessage = { id: `user-${Date.now()}`, role: "user", content: currentQuery };
    const assistantId = `assistant-${Date.now()}`;
    let hadError = false;
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "" }]);
    setIsStreaming(true);
    setStreamStatus("正在连接模型...");
    setQuery("");

    try {
      const response = await fetch(`${apiBase}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: currentQuery, conversation_id: conversationId }),
      });
      if (!response.ok || !response.body) {
        throw new Error(`stream request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let nextConversationId = conversationId;
      let finalTask = null;
      let streamedAnswer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";

        for (const frame of frames) {
          if (!frame.startsWith("data: ")) continue;
          const payload = JSON.parse(frame.slice(6));
          if (payload.type === "conversation") {
            nextConversationId = payload.conversation_id;
            setConversationId(payload.conversation_id);
          }
          if (payload.type === "status") {
            setStreamStatus(payload.message);
          }
          if (payload.type === "delta") {
            streamedAnswer += payload.content;
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, content: streamedAnswer } : message,
              ),
            );
          }
          if (payload.type === "done") {
            finalTask = payload.task;
          }
        }
      }

      if (finalTask?.citations?.length) {
        setCitationMap((current) => ({ ...current, [assistantId]: finalTask.citations }));
      }
      setConversationId(nextConversationId);
      await refreshDashboard();
    } catch (error) {
      hadError = true;
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
      if (!hadError) {
        setStreamStatus("");
      }
    }
  }

  async function handleRunEvaluation() {
    const data = await fetchJson("/evaluate/run", { method: "POST" });
    setEvaluation(data.run);
    setActiveTab("evaluation");
    await refreshDashboard();
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>AegisCopilot</strong>
          <span>企业知识库智能助手</span>
        </div>
        <nav className="topnav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={tab.id === activeTab ? "tab active" : "tab"}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          {modelCatalog ? (
            <label className="model-picker">
              <span>Model</span>
              <select value={modelCatalog.active_model} onChange={handleModelChange}>
                {modelCatalog.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="button" className="ghost" onClick={handleRunEvaluation}>
            运行评估
          </button>
        </div>
      </header>

      {stats ? (
        <section className="stats-row">
          <article className="stat-pill">
            <span>文档数</span>
            <strong>{stats.documents}</strong>
          </article>
          <article className="stat-pill">
            <span>片段数</span>
            <strong>{stats.indexed_chunks}</strong>
          </article>
          <article className="stat-pill">
            <span>会话数</span>
            <strong>{stats.conversations}</strong>
          </article>
          <article className="stat-pill">
            <span>模型</span>
            <strong>{stats.llm_model}</strong>
          </article>
          <article className="stat-pill">
            <span>Provider</span>
            <strong>{stats.llm_provider}</strong>
            <small>{stats.api_key_configured ? "API key ready" : "API key missing"}</small>
          </article>
        </section>
      ) : null}

      {activeTab === "chat" ? (
        <main className="workspace">
          <aside className="sidebar">
            <div className="sidebar-header">
              <h2>聊天</h2>
              <button type="button" className="icon-button" onClick={handleCreateConversation}>
                +
              </button>
            </div>
            <div className="conversation-list">
              {conversations.map((conversation) => (
                <article
                  key={conversation.id}
                  className={conversation.id === conversationId ? "conversation-card active" : "conversation-card"}
                  onClick={() => handleSelectConversation(conversation)}
                >
                  <div className="conversation-main">
                    <strong>{conversation.title || "新对话"}</strong>
                    <span>{formatTime(conversation.updated_at)}</span>
                  </div>
                  <button
                    type="button"
                    className="delete-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteConversation(conversation.id).catch(console.error);
                    }}
                  >
                    删除
                  </button>
                </article>
              ))}
            </div>
          </aside>

          <section className="chat-panel">
            <div className="prompt-row">
              {starterPrompts.map((item) => (
                <button key={item} className="prompt-chip" type="button" onClick={() => setQuery(item)}>
                  {item}
                </button>
              ))}
            </div>

            <div className="message-list">
              {messages.length ? (
                messages.map((message) => (
                  <article key={message.id || `${message.role}-${message.content}`} className={`message ${message.role}`}>
                    <div className="message-body">
                      <span className="message-role">{message.role === "user" ? "用户" : "助手"}</span>
                      <p>{message.content}</p>
                    </div>
                    {message.role === "assistant" && citationMap[message.id]?.length ? (
                      <div className="message-sources">
                        {citationMap[message.id].map((item) => (
                          <span key={item.chunk_id} className="source-chip">
                            {item.display_source}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <h3>开始一个新问题</h3>
                  <p>你可以直接提问，也可以先去知识库页上传 PDF、Word 或文本文件。</p>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="composer">
              <input
                placeholder="请输入问题，例如：生产发布前需要准备什么？"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="submit" className="primary" disabled={isStreaming}>
                {isStreaming ? "生成中..." : "发送"}
              </button>
            </form>
            {streamStatus ? <p className="stream-status">{streamStatus}</p> : null}
          </section>
        </main>
      ) : null}

      {activeTab === "knowledge" ? (
        <main className="content-page">
          <section className="upload-hero">
            <div>
              <h2>知识库录入</h2>
              <p>支持上传 `txt`、`md`、`pdf`、`docx` 文件，系统会自动提取文本并建立索引。</p>
            </div>
            <label className="upload-button">
              上传文档
              <input type="file" accept=".txt,.md,.markdown,.pdf,.docx" onChange={handleUploadDocument} hidden />
            </label>
          </section>
          {uploadStatus ? <p className="upload-status">{uploadStatus}</p> : null}

          <section className="document-grid">
            {documents.map((document) => (
              <article key={document.id} className="document-card">
                <div className="document-head">
                  <strong>{document.title}</strong>
                  <span>{document.department}</span>
                </div>
                <p>{document.indexed_label}</p>
                <div className="document-meta">
                  <small>{document.source_type}</small>
                  <button
                    type="button"
                    className="document-delete"
                    onClick={() => handleDeleteDocument(document.id).catch(console.error)}
                  >
                    删除
                  </button>
                </div>
              </article>
            ))}
          </section>
        </main>
      ) : null}

      {activeTab === "evaluation" ? (
        <main className="content-page">
          <section className="evaluation-header">
            <div>
              <h2>离线评估</h2>
              <p>用样例问题批量验证回答率、引用命中率和关键词命中率。</p>
            </div>
            <button type="button" className="primary" onClick={handleRunEvaluation}>
              重新运行评估
            </button>
          </section>

          {evaluation ? (
            <section className="evaluation-grid">
              <article className="metric-panel">
                <span>测试样例</span>
                <strong>{evaluation.cases}</strong>
              </article>
              <article className="metric-panel">
                <span>回答率</span>
                <strong>{evaluation.answer_rate}</strong>
              </article>
              <article className="metric-panel">
                <span>引用命中率</span>
                <strong>{evaluation.citation_hit_rate}</strong>
              </article>
              <article className="metric-panel">
                <span>关键词命中率</span>
                <strong>{evaluation.keyword_hit_rate}</strong>
              </article>
            </section>
          ) : (
            <div className="empty-state">
              <h3>还没有评估结果</h3>
              <p>点击上方按钮运行一次离线评估。</p>
            </div>
          )}
        </main>
      ) : null}
    </div>
  );
}
