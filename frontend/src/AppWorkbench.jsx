import { useEffect, useMemo, useState } from "react";

const apiBase = "http://127.0.0.1:8002";

const navItems = [
  { id: "chat", label: "聊天工作台", hint: "RAG 智能问答" },
  { id: "knowledge", label: "管理后台", hint: "知识库与文档治理" },
  { id: "evaluation", label: "评估中心", hint: "效果验证与指标" },
];

const starterPrompts = [
  "员工请假需要提前多久申请？",
  "生产发布前需要准备什么？",
  "请总结差旅报销流程",
  "跨境电商公司在个人信息保护方面要注意哪些问题？",
];

const scenarioCards = [
  {
    title: "实时数据",
    description: "快速追问企业制度、流程和常见规范。",
    prompt: "生产发布前需要准备什么？",
  },
  {
    title: "系统交互",
    description: "通过多轮对话形成可执行答案。",
    prompt: "请总结差旅报销流程",
  },
  {
    title: "业务系统",
    description: "结合知识库内容给出结构化建议。",
    prompt: "员工请假需要提前多久申请？",
  },
];

const currentUser = {
  name: "admin",
  role: "管理员",
  email: "owner@aegis.local",
};

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

function conversationPreview(conversation) {
  const latest = conversation.messages?.[conversation.messages.length - 1];
  return latest?.content || "从空白开始";
}

export function AppWorkbench() {
  const [activeSection, setActiveSection] = useState("chat");
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
  const [conversationFilter, setConversationFilter] = useState("");

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

  const filteredConversations = useMemo(() => {
    const keyword = conversationFilter.trim().toLowerCase();
    if (!keyword) {
      return conversations;
    }
    return conversations.filter((conversation) => {
      const text = [conversation.title, ...(conversation.messages || []).map((item) => item.content)]
        .join(" ")
        .toLowerCase();
      return text.includes(keyword);
    });
  }, [conversationFilter, conversations]);

  async function handleCreateConversation() {
    const data = await fetchJson("/conversations", {
      method: "POST",
      body: JSON.stringify({ title: "新对话" }),
    });
    setConversationId(data.conversation.id);
    setMessages([]);
    setCitationMap({});
    setActiveSection("chat");
    await refreshDashboard();
  }

  function handleSelectConversation(conversation) {
    setConversationId(conversation.id);
    setMessages(conversation.messages || []);
    setCitationMap({});
    setActiveSection("chat");
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
    setUploadStatus("正在解析并建立索引...");
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${apiBase}/documents/upload`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      setUploadStatus("文档上传失败，请检查格式是否正确。");
      return;
    }
    await response.json();
    setUploadStatus(`文档已录入：${file.name}`);
    await refreshDashboard();
    setActiveSection("knowledge");
  }

  async function handleDeleteDocument(documentId) {
    await fetchJson(`/documents/${documentId}`, { method: "DELETE" });
    setUploadStatus("文档已从知识库删除");
    await refreshDashboard();
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    if (!query.trim() || isStreaming) return;

    const currentQuery = query.trim();
    const userMessage = { id: `user-${Date.now()}`, role: "user", content: currentQuery };
    const assistantId = `assistant-${Date.now()}`;
    let hadError = false;
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "" }]);
    setIsStreaming(true);
    setStreamStatus("正在连接模型...");
    setQuery("");
    setActiveSection("chat");

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
          message.id === assistantId ? { ...message, content: "连接模型失败，请稍后重试。" } : message,
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

  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage(event);
    }
  }

  async function handleRunEvaluation() {
    const data = await fetchJson("/evaluate/run", { method: "POST" });
    setEvaluation(data.run);
    setActiveSection("evaluation");
    await refreshDashboard();
  }

  const activeConversationTitle =
    conversations.find((item) => item.id === conversationId)?.title || "新对话";

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-panel">
          <div className="brand-mark">AI</div>
          <div>
            <strong>AegisCopilot</strong>
            <p>RAG 智能问答</p>
          </div>
        </div>

        <div className="quick-start-card">
          <div className="quick-start-head">
            <span>快速开始</span>
            <button type="button" className="mini-link" onClick={handleCreateConversation}>
              新内容
            </button>
          </div>
          <button type="button" className="quick-action" onClick={handleCreateConversation}>
            <span className="quick-action-icon">+</span>
            <div>
              <strong>新建对话</strong>
              <small>从空白开始</small>
            </div>
          </button>
          <button type="button" className="admin-entry" onClick={() => setActiveSection("knowledge")}>
            管理后台
          </button>
        </div>

        <label className="search-panel">
          <span>搜索对话</span>
          <input
            value={conversationFilter}
            onChange={(event) => setConversationFilter(event.target.value)}
            placeholder="搜索标题或内容..."
          />
        </label>

        <nav className="nav-stack">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === activeSection ? "nav-item active" : "nav-item"}
              onClick={() => setActiveSection(item.id)}
            >
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </button>
          ))}
        </nav>

        <section className="conversation-section">
          <div className="section-label">
            <span>最近会话</span>
            <small>{filteredConversations.length}</small>
          </div>
          <div className="conversation-scroll">
            {filteredConversations.map((conversation) => (
              <article
                key={conversation.id}
                className={conversation.id === conversationId ? "conversation-card active" : "conversation-card"}
                onClick={() => handleSelectConversation(conversation)}
              >
                <div className="conversation-main">
                  <strong>{conversation.title || "新对话"}</strong>
                  <span>{conversationPreview(conversation)}</span>
                </div>
                <div className="conversation-meta">
                  <small>{formatTime(conversation.updated_at)}</small>
                  <button
                    type="button"
                    className="danger-link"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteConversation(conversation.id).catch(console.error);
                    }}
                  >
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="user-panel">
          <div className="avatar-dot">{currentUser.name.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{currentUser.name}</strong>
            <p>
              {currentUser.role} · {currentUser.email}
            </p>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <header className="main-header">
          <div>
            <span className="eyebrow">{navItems.find((item) => item.id === activeSection)?.hint}</span>
            <h1>{activeSection === "chat" ? activeConversationTitle : navItems.find((item) => item.id === activeSection)?.label}</h1>
          </div>
          <div className="header-actions">
            {modelCatalog ? (
              <label className="model-picker">
                <span>模型</span>
                <select value={modelCatalog.active_model} onChange={handleModelChange}>
                  {modelCatalog.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button type="button" className="secondary-button" onClick={handleRunEvaluation}>
              运行评估
            </button>
          </div>
        </header>

        {stats ? (
          <section className="stats-grid">
            <article className="stat-card">
              <span>文档数</span>
              <strong>{stats.documents}</strong>
              <small>已录入知识资产</small>
            </article>
            <article className="stat-card">
              <span>Chunk 数</span>
              <strong>{stats.indexed_chunks}</strong>
              <small>已建立可检索片段</small>
            </article>
            <article className="stat-card">
              <span>会话数</span>
              <strong>{stats.conversations}</strong>
              <small>聊天与问答记录</small>
            </article>
            <article className="stat-card">
              <span>当前模型</span>
              <strong>{stats.llm_model}</strong>
              <small>{stats.llm_provider}</small>
            </article>
          </section>
        ) : null}

        {activeSection === "chat" ? (
          <section className="chat-workspace">
            <div className="hero-panel">
              <span className="hero-badge">RAG 智能问答</span>
              <h2>把问题变成清晰答案</h2>
              <p>结构化提问、知识检索与回答生成，在一次对话中形成可执行结论。</p>
            </div>

            <form className="hero-composer" onSubmit={handleSendMessage}>
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="输入需要深入分析的问题，例如：生产发布前需要准备什么？"
                rows={4}
              />
              <div className="composer-toolbar">
                <div className="chip-row">
                  {starterPrompts.map((item) => (
                    <button key={item} type="button" className="ghost-chip" onClick={() => setQuery(item)}>
                      {item}
                    </button>
                  ))}
                </div>
                <button type="submit" className="primary-button" disabled={isStreaming}>
                  {isStreaming ? "生成中..." : "发送"}
                </button>
              </div>
              {streamStatus ? <p className="stream-status">{streamStatus}</p> : null}
            </form>

            <div className="scenario-grid">
              {scenarioCards.map((card) => (
                <button
                  key={card.title}
                  type="button"
                  className="scenario-card"
                  onClick={() => setQuery(card.prompt)}
                >
                  <strong>{card.title}</strong>
                  <p>{card.description}</p>
                  <small>{card.prompt}</small>
                </button>
              ))}
            </div>

            <section className="message-stage">
              {messages.length ? (
                messages.map((message) => (
                  <article key={message.id || `${message.role}-${message.content}`} className={`message-row ${message.role}`}>
                    <div className="message-card">
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
                <div className="empty-panel">
                  <strong>从一个新问题开始</strong>
                  <p>你可以先上传知识库文档，再围绕制度、流程、产品或安全问题发起多轮问答。</p>
                </div>
              )}
            </section>
          </section>
        ) : null}

        {activeSection === "knowledge" ? (
          <section className="admin-page">
            <div className="page-hero knowledge-hero">
              <div>
                <span className="eyebrow">Knowledge Admin</span>
                <h2>知识库管理后台</h2>
                <p>把文档录入、索引状态、数据治理和模型配置放到后台统一管理，主工作台只保留对话体验。</p>
              </div>
              <div className="hero-stack">
                <label className="primary-button upload-trigger">
                  上传文档
                  <input type="file" accept=".txt,.md,.markdown,.pdf,.docx" onChange={handleUploadDocument} hidden />
                </label>
                <div className="hero-note">
                  <strong>支持 TXT / MD / PDF / DOCX</strong>
                  <span>上传后自动提取文本并建立索引</span>
                </div>
              </div>
            </div>

            {uploadStatus ? <p className="upload-status">{uploadStatus}</p> : null}

            <section className="stats-grid admin-stats">
              <article className="metric-card">
                <span>文档总数</span>
                <strong>{documents.length}</strong>
                <small>当前知识库内可管理文档</small>
              </article>
              <article className="metric-card">
                <span>已索引</span>
                <strong>{documents.filter((document) => document.indexed).length}</strong>
                <small>可直接参与检索问答</small>
              </article>
              <article className="metric-card">
                <span>待治理</span>
                <strong>{documents.filter((document) => !document.indexed).length}</strong>
                <small>可继续补充或删除</small>
              </article>
              <article className="metric-card">
                <span>部门数</span>
                <strong>{new Set(documents.map((document) => document.department).filter(Boolean)).size}</strong>
                <small>按业务域组织内容</small>
              </article>
            </section>

            <div className="knowledge-toolbar">
              <input
                className="search-input"
                placeholder="搜索文档标题、部门、类型、版本..."
                value={knowledgeSearch}
                onChange={(event) => setKnowledgeSearch(event.target.value)}
              />
              <select
                className="filter-select"
                value={knowledgeDepartment}
                onChange={(event) => setKnowledgeDepartment(event.target.value)}
              >
                {knowledgeDepartments.map((department) => (
                  <option key={department} value={department}>
                    {department === "all" ? "全部部门" : department}
                  </option>
                ))}
              </select>
              <select className="filter-select" value={knowledgeState} onChange={(event) => setKnowledgeState(event.target.value)}>
                <option value="all">全部状态</option>
                <option value="indexed">已索引</option>
                <option value="pending">未索引</option>
              </select>
            </div>

            <div className="admin-table-wrap">
              <div className="admin-table-head">
                <span>文档</span>
                <span>部门</span>
                <span>索引状态</span>
                <span>来源</span>
                <span>操作</span>
              </div>

              <div className="admin-list">
                {knowledgeDocuments.length ? (
                  knowledgeDocuments.map((document) => (
                    <article key={document.id} className="admin-row">
                      <div className="document-main">
                        <strong>{document.title}</strong>
                        <small>
                          {document.version} · {formatTime(document.indexed_at || document.created_at)}
                        </small>
                      </div>
                      <span className="tag-chip">{document.department}</span>
                      <span className={document.indexed ? "status-chip online" : "status-chip idle"}>
                        {document.indexed ? document.indexed_label : "未索引"}
                      </span>
                      <span className="muted-text">
                        {document.source_type}
                        <br />
                        {document.chunk_count ?? 0} chunks
                      </span>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => handleDeleteDocument(document.id).catch(console.error)}
                      >
                        删除
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="table-empty">
                    <strong>没有匹配的文档</strong>
                    <p>调整筛选条件，或者直接上传新的业务文档。</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeSection === "evaluation" ? (
          <section className="admin-page">
            <div className="page-hero">
              <div>
                <span className="eyebrow">Evaluation</span>
                <h2>效果评估中心</h2>
                <p>用离线测试集验证回答率、引用命中率与关键词命中率，观察系统迭代效果。</p>
              </div>
              <button type="button" className="primary-button" onClick={handleRunEvaluation}>
                重新运行评估
              </button>
            </div>

            {evaluation ? (
              <div className="evaluation-panels">
                <article className="metric-card">
                  <span>测试样例</span>
                  <strong>{evaluation.cases}</strong>
                </article>
                <article className="metric-card">
                  <span>回答率</span>
                  <strong>{evaluation.answer_rate}</strong>
                </article>
                <article className="metric-card">
                  <span>引用命中率</span>
                  <strong>{evaluation.citation_hit_rate}</strong>
                </article>
                <article className="metric-card">
                  <span>关键词命中率</span>
                  <strong>{evaluation.keyword_hit_rate}</strong>
                </article>
              </div>
            ) : (
              <div className="empty-panel">
                <strong>还没有评估结果</strong>
                <p>点击右上角按钮运行一轮离线评估，系统会展示当前知识问答效果。</p>
              </div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
