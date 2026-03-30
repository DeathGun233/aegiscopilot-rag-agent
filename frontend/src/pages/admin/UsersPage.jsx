import { useAppContext } from "../../context/AppContext";
import { formatDateTime } from "../../lib/format";

export function UsersPage() {
  const { currentUserId, setCurrentUserId, users } = useAppContext();

  return (
    <div className="admin-content">
      <section className="dashboard-hero">
        <div>
          <span className="hero-pill">Users</span>
          <h2>用户与权限</h2>
          <p>模拟企业内部管理员和普通成员的身份切换，便于展示权限差异。</p>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">User Directory</span>
            <h3>用户列表</h3>
          </div>
        </div>

        <div className="user-grid">
          {users.map((user) => (
            <article key={user.id} className="user-list-card">
              <div className="user-row">
                <div className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <strong>{user.name}</strong>
                  <p>{user.role === "admin" ? "管理员" : "成员"}</p>
                </div>
              </div>

              <div className="definition-list compact">
                <div>
                  <span>创建时间</span>
                  <strong>{formatDateTime(user.created_at)}</strong>
                </div>
                <div>
                  <span>当前状态</span>
                  <strong>{user.id === currentUserId ? "使用中" : "可切换"}</strong>
                </div>
              </div>

              <button
                type="button"
                className="primary-action"
                onClick={() => setCurrentUserId(user.id)}
              >
                切换为该用户
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
