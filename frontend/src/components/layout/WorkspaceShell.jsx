import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import { formatDateTime, getConversationPreview, truncate } from "../../lib/format";

const primaryNav = [
  { to: "/chat", label: "聊天", hint: "用户问答工作台" },
  { to: "/admin/overview", label: "管理后台", hint: "知识库与系统配置" },
];

export function WorkspaceShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    conversations,
    createConversation,
    currentUser,
    currentUserId,
    deleteConversation,
    globalNotice,
    modelCatalog,
    selectModel,
    setCurrentUserId,
    setGlobalNotice,
    stats,
    users,
  } = useAppContext();
  const [keyword, setKeyword] = useState("");

  const filteredConversations = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) {
      return conversations;
    }
    return conversations.filter((conversation) =>
      [conversation.title, ...(conversation.messages || []).map((item) => item.content)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [conversations, keyword]);

  async function handleCreateConversation() {
    const conversation = await createConversation("新对话");
    navigate(`/chat/${conversation.id}`);
  }

  async function handleDeleteConversation(event, conversationId) {
    event.stopPropagation();
    await deleteConversation(conversationId);
    if (location.pathname === `/chat/${conversationId}`) {
      navigate("/chat");
    }
  }

  return (
    <div className="workspace-shell">
      <aside className="left-rail">
        <div className="brand-block">
          <div className="brand-badge">AI</div>
          <div>
            <strong>AegisCopilot</strong>
            <p>企业知识库智能助手</p>
          </div>
        </div>

        <nav className="rail-nav">
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive || location.pathname.startsWith(item.to)
                  ? "rail-nav-item active"
                  : "rail-nav-item"
              }
            >
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </NavLink>
          ))}
        </nav>

        <section className="rail-card launch-card">
          <div className="card-title-row">
            <span>快速开始</span>
            <button type="button" className="text-link" onClick={handleCreateConversation}>
              新建
            </button>
          </div>
          <button type="button" className="launch-button" onClick={handleCreateConversation}>
            <span className="launch-icon">+</span>
            <div>
              <strong>新建对话</strong>
              <small>从空白开始一轮新的知识问答</small>
            </div>
          </button>
          <button
            type="button"
            className="panel-shortcut"
            onClick={() => navigate("/admin/knowledge")}
          >
            进入知识库后台
          </button>
        </section>

        <label className="search-card">
          <span>搜索会话</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索标题或消息内容"
          />
        </label>

        <section className="conversation-pane">
          <div className="section-head">
            <span>最近会话</span>
            <small>{filteredConversations.length}</small>
          </div>
          <div className="conversation-list">
            {filteredConversations.length ? (
              filteredConversations.map((conversation) => (
                <article
                  key={conversation.id}
                  className={
                    location.pathname === `/chat/${conversation.id}`
                      ? "conversation-item active"
                      : "conversation-item"
                  }
                  onClick={() => navigate(`/chat/${conversation.id}`)}
                >
                  <div className="conversation-copy">
                    <strong>{conversation.title || "新对话"}</strong>
                    <p>{truncate(getConversationPreview(conversation), 56)}</p>
                  </div>
                  <div className="conversation-actions">
                    <small>{formatDateTime(conversation.updated_at)}</small>
                    <button
                      type="button"
                      className="danger-text"
                      onClick={(event) => handleDeleteConversation(event, conversation.id)}
                    >
                      删除
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="table-empty">还没有历史会话，可以先新建一个对话。</div>
            )}
          </div>
        </section>

        <div className="rail-footer">
          <div className="user-card">
            <div className="user-avatar">
              {(currentUser?.name || "A").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{currentUser?.name || "admin"}</strong>
              <p>{currentUser?.role === "admin" ? "管理员" : "成员"}</p>
            </div>
          </div>

          <label className="identity-switch">
            <span>当前身份</span>
            <select value={currentUserId} onChange={(event) => setCurrentUserId(event.target.value)}>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          </label>

          {modelCatalog ? (
            <label className="identity-switch">
              <span>当前模型</span>
              <select
                value={modelCatalog.active_model}
                onChange={(event) => selectModel(event.target.value).catch(console.error)}
                disabled={currentUser?.role !== "admin"}
              >
                {modelCatalog.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {stats ? (
            <div className="rail-stats">
              <span>{stats.documents} 文档</span>
              <span>{stats.conversations} 会话</span>
              <span>{stats.tasks} 任务</span>
            </div>
          ) : null}

          {globalNotice ? (
            <button type="button" className="global-notice" onClick={() => setGlobalNotice("")}>
              {globalNotice}
            </button>
          ) : null}
        </div>
      </aside>

      <div className="workspace-stage">{children}</div>
    </div>
  );
}
