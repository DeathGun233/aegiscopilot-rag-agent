import { useAppContext } from "../../context/AppContext";

export function DashboardPage() {
  const { currentUser, documents, modelCatalog, stats, users } = useAppContext();

  return (
    <div className="admin-content">
      <section className="dashboard-hero">
        <div>
          <span className="hero-pill">Operations</span>
          <h2>系统运行概览</h2>
          <p>把知识库、模型、用户和会话状态放到一个后台中统一管理。</p>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <span>知识文档</span>
          <strong>{stats?.documents ?? 0}</strong>
          <small>当前已录入知识库</small>
        </article>
        <article className="metric-card">
          <span>索引片段</span>
          <strong>{stats?.indexed_chunks ?? 0}</strong>
          <small>检索可用 chunk</small>
        </article>
        <article className="metric-card">
          <span>会话数量</span>
          <strong>{stats?.conversations ?? 0}</strong>
          <small>历史问答记录</small>
        </article>
        <article className="metric-card">
          <span>任务数量</span>
          <strong>{stats?.tasks ?? 0}</strong>
          <small>Agent 执行轨迹</small>
        </article>
      </section>

      <section className="admin-grid two-columns">
        <article className="panel-card">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">Knowledge Snapshot</span>
              <h3>最近知识文档</h3>
            </div>
          </div>
          <div className="chunk-list">
            {documents.slice(0, 5).map((document) => (
              <article key={document.id} className="chunk-card">
                <strong>{document.title}</strong>
                <p>{document.department} · {document.chunk_count || 0} 个片段</p>
              </article>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">Runtime</span>
              <h3>运行状态</h3>
            </div>
          </div>
          <div className="definition-list">
            <div>
              <span>当前用户</span>
              <strong>{currentUser?.name || "admin"}</strong>
            </div>
            <div>
              <span>用户数</span>
              <strong>{users.length}</strong>
            </div>
            <div>
              <span>模型提供方</span>
              <strong>{stats?.llm_provider || "-"}</strong>
            </div>
            <div>
              <span>当前模型</span>
              <strong>{modelCatalog?.active_model || stats?.llm_model || "-"}</strong>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
