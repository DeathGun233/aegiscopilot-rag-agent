import { Link } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";

export function DashboardPage() {
  const { currentUser, documents, stats } = useAppContext();

  return (
    <div className="admin-page-grid">
      <section className="overview-cards">
        <article className="metric-card">
          <span>Documents</span>
          <strong>{stats?.documents ?? 0}</strong>
          <small>Indexed knowledge sources</small>
        </article>
        <article className="metric-card">
          <span>Chunks</span>
          <strong>{stats?.indexed_chunks ?? 0}</strong>
          <small>Searchable passages</small>
        </article>
        <article className="metric-card">
          <span>Conversations</span>
          <strong>{stats?.conversations ?? 0}</strong>
          <small>Historical chat sessions</small>
        </article>
        <article className="metric-card">
          <span>Tasks</span>
          <strong>{stats?.tasks ?? 0}</strong>
          <small>Agent execution records</small>
        </article>
      </section>

      <section className="content-card">
        <div className="card-head">
          <div>
            <span className="eyebrow">Knowledge Snapshot</span>
            <h3>Recent documents</h3>
          </div>
          <Link to="/admin/knowledge" className="inline-link">
            Open knowledge base
          </Link>
        </div>
        <div className="simple-list">
          {documents.slice(0, 6).map((document) => (
            <Link key={document.id} to={`/admin/knowledge/${document.id}`} className="simple-row">
              <div>
                <strong>{document.title}</strong>
                <p>{document.department}</p>
              </div>
              <span>{document.chunk_count || 0} chunks</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="content-card">
        <div className="card-head">
          <div>
            <span className="eyebrow">Current Operator</span>
            <h3>User context</h3>
          </div>
        </div>
        <div className="identity-summary">
          <strong>{currentUser?.name || "admin"}</strong>
          <p>{currentUser?.role === "admin" ? "Administrator" : "Member"}</p>
          <div className="tag-row">
            {(currentUser?.permissions || []).map((item) => (
              <span key={item} className="tag-chip">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
