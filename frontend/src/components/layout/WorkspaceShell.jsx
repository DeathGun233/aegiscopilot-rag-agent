import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import { formatDateTime, getConversationPreview, truncate } from "../../lib/format";

const primaryNav = [
  { to: "/chat", label: "Chat", hint: "User Q&A workspace" },
  { to: "/admin/overview", label: "Admin", hint: "Knowledge and system control" },
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

  async function handleCreateConversation() {
    const conversation = await createConversation();
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
    <div className="shell-root">
      <aside className="shell-sidebar">
        <div className="brand-block">
          <div className="brand-logo">A</div>
          <div>
            <strong>AegisCopilot</strong>
            <p>Enterprise RAG Workspace</p>
          </div>
        </div>

        <div className="quick-card">
          <div className="quick-card-head">
            <span>Quick start</span>
            <button type="button" className="mini-button" onClick={handleCreateConversation}>
              New
            </button>
          </div>
          <button type="button" className="primary-quick-action" onClick={handleCreateConversation}>
            <span className="action-icon">+</span>
            <div>
              <strong>New conversation</strong>
              <small>Start a fresh knowledge-grounded chat</small>
            </div>
          </button>
          <button
            type="button"
            className="ghost-quick-action"
            onClick={() => navigate("/admin/knowledge")}
          >
            Open admin console
          </button>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive || location.pathname.startsWith(item.to)
                  ? "nav-card active"
                  : "nav-card"
              }
            >
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </NavLink>
          ))}
        </nav>

        <section className="sidebar-section">
          <div className="section-title">
            <span>Recent conversations</span>
            <small>{conversations.length}</small>
          </div>
          <div className="conversation-list">
            {conversations.length ? (
              conversations.map((conversation) => (
                <article
                  key={conversation.id}
                  className={
                    location.pathname === `/chat/${conversation.id}`
                      ? "conversation-row active"
                      : "conversation-row"
                  }
                >
                  <button
                    type="button"
                    className="conversation-select"
                    onClick={() => navigate(`/chat/${conversation.id}`)}
                  >
                    <strong>{conversation.title || "New conversation"}</strong>
                    <span>{truncate(getConversationPreview(conversation), 52)}</span>
                    <small>{formatDateTime(conversation.updated_at)}</small>
                  </button>
                  <button
                    type="button"
                    className="conversation-delete"
                    onClick={(event) => handleDeleteConversation(event, conversation.id)}
                    title="Delete conversation"
                  >
                    x
                  </button>
                </article>
              ))
            ) : (
              <div className="sidebar-empty">
                <strong>No conversation history yet</strong>
                <span>Create the first one from the top card.</span>
              </div>
            )}
          </div>
        </section>

        <div className="sidebar-footer">
          <label className="control-block">
            <span>Current user</span>
            <select value={currentUserId} onChange={(event) => setCurrentUserId(event.target.value)}>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          </label>

          {modelCatalog ? (
            <label className="control-block">
              <span>Model</span>
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

          <div className="profile-card">
            <div className="profile-avatar">
              {(currentUser?.name || "A").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{currentUser?.name || "admin"}</strong>
              <p>{currentUser?.role === "admin" ? "Administrator" : "Member"}</p>
            </div>
          </div>

          {stats ? (
            <div className="tag-row">
              <span className="tag-chip">{stats.documents} docs</span>
              <span className="tag-chip">{stats.conversations} chats</span>
              <span className="tag-chip">{stats.tasks} tasks</span>
            </div>
          ) : null}

          {globalNotice ? (
            <button type="button" className="notice-banner" onClick={() => setGlobalNotice("")}>
              {globalNotice}
            </button>
          ) : null}
        </div>
      </aside>

      <section className="shell-main">{children}</section>
    </div>
  );
}
