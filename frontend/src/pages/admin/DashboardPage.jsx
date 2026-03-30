import { useAppContext } from "../../context/AppContext";

export function DashboardPage() {
  const { stats, modelCatalog, currentUser, users } = useAppContext();

  return (
    <div className="admin-content">
      <section className="dashboard-hero">
        <div>
          <span className="hero-pill">Operations</span>
          <h2>系统运行概览</h2>
          <p>把知识库、模型、用户与会话状态集中在一个后台里管理。</p>
        </div>
      </section>

      {stats ? (
        <section className="metric-grid">
          <article className="metric-card">
            <span>知识文档</span>
            <strong>{stats.documents}</strong>
            <small>当前已录入知识库</small>
          </article>
          <article className="metric-card">
            <span>索引片段</span>
            <strong>{stats.indexed_chunks}</strong>
            <small>检索可用 chunk 总数</small>
          </article>
          <article className="metric-card">
            <span>会话数量</span>
            <strong>{stats.conversations}</strong>
            <small>历史问答与聊天记录</small>
          </article>
          <article className="metric-card">
            <span>Agent 任务</span>
            <strong>{stats.tasks}</strong>
            <small>累计执行记录</small>
          </article>
        </section>
      ) : null}

      <section className="admin-grid two-columns">
        <article className="panel-card">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">Model Runtime</span>
              <h3>模型运行配置</h3>
            </div>
          </div>
          {modelCatalog ? (
            <div className="definition-list">
              <div>
                <span>提供方</span>
                <strong>{modelCatalog.provider}</strong>
              </div>
              <div>
                <span>当前模型</span>
                <strong>{modelCatalog.active_model}</strong>
              </div>
              <div>
                <span>兼容地址</span>
                <strong>{modelCatalog.base_url}</strong>
              </div>
              <div>
                <span>密钥状态</span>
                <strong>{modelCatalog.api_key_configured ? "已配置" : "未配置"}</strong>
              </div>
            </div>
          ) : null}
        </article>

        <article className="panel-card">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">User Session</span>
              <h3>当前身份</h3>
            </div>
          </div>
          <div className="definition-list">
            <div>
              <span>用户名</span>
              <strong>{currentUser?.name || "admin"}</strong>
            </div>
            <div>
              <span>角色</span>
              <strong>{currentUser?.role || "admin"}</strong>
            </div>
            <div>
              <span>系统用户数</span>
              <strong>{users.length}</strong>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
