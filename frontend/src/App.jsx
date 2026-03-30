import { useEffect, useState } from "react";

const apiBase = "http://127.0.0.1:8001";
const starterPrompts = [
  "员工请假需要提前多久申请？",
  "请总结差旅报销流程",
  "生产发布前需要准备什么？",
  "请对比请假制度和报销流程的审批链路",
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

function humanizeSource(source) {
  if (!source) return "";
  const match = source.match(/#chunk-(\d+)$/);
  if (!match) return source;
  const index = Number(match[1]) + 1;
  return source.replace(/#chunk-\d+$/, ` | 片段 ${index}`);
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

export function App() {
  const [documents, setDocuments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [stats, setStats] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [taskTrace, setTaskTrace] = useState([]);
  const [citations, setCitations] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [retrievalPreview, setRetrievalPreview] = useState([]);
  const [streamStatus, setStreamStatus] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    department: "general",
  });

  async function refreshDashboard() {
    const [docsData, statsData, conversationsData] = await Promise.all([
      fetchJson("/documents"),
      fetchJson("/system/stats"),
      fetchJson("/conversations"),
    ]);
    setDocuments(docsData.documents);
    setStats(statsData.stats);
    setConversations(conversationsData.conversations.slice(-5).reverse());
  }

  useEffect(() => {
    refreshDashboard().catch(console.error);
  }, []);

  async function handleCreateDocument(event) {
    event.preventDefault();
    const created = await fetchJson("/documents", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        source_type: "text",
        version: "v1",
        tags: [],
      }),
    });
    await fetchJson("/documents/index", {
      method: "POST",
      body: JSON.stringify({ document_id: created.document.id }),
    });
    setForm({ title: "", content: "", department: "general" });
    await refreshDashboard();
  }

  async function runPreview(searchQuery) {
    if (!searchQuery.trim()) {
      setRetrievalPreview([]);
      return;
    }
    const data = await fetchJson("/retrieval/preview", {
      method: "POST",
      body: JSON.stringify({ query: searchQuery, top_k: 3 }),
    });
    setRetrievalPreview(data.results);
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    if (!query.trim()) return;
    const currentQuery = query;
    const userMessage = { id: `user-${Date.now()}`, role: "user", content: currentQuery };
    const assistantId = `assistant-${Date.now()}`;
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "" }]);
    setIsStreaming(true);
    setStreamStatus("正在连接模型...");
    const response = await fetch(`${apiBase}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: currentQuery, conversation_id: conversationId }),
    });
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

    setConversationId(nextConversationId);
    if (finalTask) {
      setTaskTrace(finalTask.trace);
      setCitations(finalTask.citations);
    }
    setQuery("");
    setStreamStatus("");
    setIsStreaming(false);
    await runPreview(currentQuery);
    await refreshDashboard();
  }

  async function handleRunEvaluation() {
    const data = await fetchJson("/evaluate/run", { method: "POST" });
    setEvaluation(data.run);
    await refreshDashboard();
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Interview-ready Enterprise AI Agent</p>
          <h1>AegisCopilot</h1>
          <p className="subtitle">
            展示企业知识库问答、任务型 workflow、可观察 trace、离线评估与可切换模型接口的 AIAgent Demo。
          </p>
        </div>
        <div className="hero-actions">
          <button className="primary" onClick={handleRunEvaluation}>
            运行评估
          </button>
        </div>
      </header>

      {stats && (
        <section className="stats-grid">
          <MetricCard label="文档数" value={stats.documents} hint="已导入知识文档" />
          <MetricCard label="Chunk 数" value={stats.indexed_chunks} hint="已建立索引片段" />
          <MetricCard label="会话数" value={stats.conversations} hint="历史会话持久化" />
          <MetricCard label="任务数" value={stats.tasks} hint="Agent 执行记录" />
          <MetricCard label="模型提供方" value={stats.llm_provider} hint={stats.llm_model} />
          <MetricCard label="Grounding 阈值" value={stats.grounding_threshold} hint={`top-k=${stats.retrieval_top_k}`} />
        </section>
      )}

      <main className="grid">
        <section className="panel">
          <h2>知识库录入</h2>
          <form onSubmit={handleCreateDocument} className="stack">
            <input
              placeholder="文档标题"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
            <input
              placeholder="所属部门"
              value={form.department}
              onChange={(event) => setForm({ ...form, department: event.target.value })}
            />
            <textarea
              rows="8"
              placeholder="粘贴制度、流程或技术文档内容"
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
            />
            <button className="primary" type="submit">
              新建并索引
            </button>
          </form>
          <div className="list">
            {documents.map((document) => (
              <article key={document.id} className="item">
                <div>
                  <strong>{document.title}</strong>
                  <p>{document.indexed_label}</p>
                </div>
                <span>{document.department}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="panel tall">
          <h2>对话与工作流</h2>
          <div className="prompt-grid">
            {starterPrompts.map((item) => (
              <button key={item} className="chip" type="button" onClick={() => setQuery(item)}>
                {item}
              </button>
            ))}
          </div>
          <div className="chat">
            {messages.map((message) => (
              <div key={message.id || `${message.role}-${message.content}`} className={`bubble ${message.role}`}>
                <span>{message.role === "user" ? "用户" : "助手"}</span>
                <p>{message.content}</p>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className="inline">
            <input
              placeholder="例如：请总结员工请假流程并指出审批链路"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="primary" type="submit" disabled={isStreaming}>
              {isStreaming ? "生成中..." : "发送"}
            </button>
          </form>
          {streamStatus ? <p className="stream-status">{streamStatus}</p> : null}
          <div className="dual">
            <div className="trace">
              <h3>Agent Trace</h3>
              {taskTrace.map((step, index) => (
                <pre key={index}>{JSON.stringify(step, null, 2)}</pre>
              ))}
            </div>
            <div className="trace">
              <h3>引用来源</h3>
              {citations.length ? (
                citations.map((item) => (
                  <article key={item.chunk_id} className="citation-card">
                    <strong>{item.document_title}</strong>
                    <span>{item.display_source || humanizeSource(item.source)}</span>
                    <p>{item.text}</p>
                  </article>
                ))
              ) : (
                <p>发送问题后这里会展示回答依据。</p>
              )}
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>检索与评估</h2>
          <div className="trace">
            <h3>检索预览</h3>
            {retrievalPreview.length ? (
              retrievalPreview.map((item) => (
                <article key={item.chunk_id} className="citation-card">
                  <strong>{item.document_title}</strong>
                  <span>{item.display_source || humanizeSource(item.source)} | score={item.score}</span>
                  <p>{item.text}</p>
                </article>
              ))
            ) : (
              <p>发送一个知识问题后，这里会显示 top-k 检索结果。</p>
            )}
          </div>

          <div className="trace">
            <h3>离线评估结果</h3>
            {evaluation ? (
              <div className="metrics">
                <div>
                  <strong>{evaluation.cases}</strong>
                  <span>测试样例</span>
                </div>
                <div>
                  <strong>{evaluation.answer_rate}</strong>
                  <span>回答率</span>
                </div>
                <div>
                  <strong>{evaluation.citation_hit_rate}</strong>
                  <span>引用命中率</span>
                </div>
                <div>
                  <strong>{evaluation.keyword_hit_rate}</strong>
                  <span>关键词命中率</span>
                </div>
              </div>
            ) : (
              <p>点击顶部按钮运行离线评估。</p>
            )}
          </div>

          <div className="trace">
            <h3>最近会话</h3>
            {conversations.length ? (
              conversations.map((item) => (
                <article key={item.id} className="item stacked">
                  <strong>{item.title}</strong>
                  <span>{item.messages.length} 条消息</span>
                </article>
              ))
            ) : (
              <p>还没有历史会话。</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
